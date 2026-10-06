"""Thorsten-Voice (Kokoro) TTS service.

Self-hosted German TTS on CPU. Model: https://huggingface.co/Thorsten-Voice/Kokoro
(fine-tune of Kokoro-82M on the public-domain Thorsten-Voice dataset, Apache 2.0).

Endpoints
  GET  /health        readiness (200 only once the model is loaded)
  POST /tts           {"text": str, "speed"?: float, "format"?: "mp3"|"wav"} -> audio bytes

Tuned for children's stories: slower default speed, one model call per sentence with
punctuation-dependent pauses, and loudness-normalised output.
"""
import json
import logging
import math
import os
import subprocess
import threading
import time
from io import BytesIO
from typing import Optional

import numpy as np
import soundfile as sf
import torch
from flask import Flask, Response, jsonify, request
from huggingface_hub import hf_hub_download

from textprep import Pauses, build_segments, normalize_text


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
REPO_ID = "Thorsten-Voice/Kokoro"
BASE_REPO_ID = "hexgrad/Kokoro-82M"
SAMPLE_RATE = 24000

CHECKPOINT = os.environ.get("KOKORO_EPOCH", "5").strip()  # 1-10, 5 = repo default (judged most natural)
DEFAULT_SPEED = _env_float("KOKORO_DEFAULT_SPEED", 0.85)  # 1.0 is too hurried for children's stories
MAX_TEXT_CHARS = int(os.environ.get("MAX_TEXT_CHARS", "6000"))
GROUP_MAX_CHARS = int(os.environ.get("GROUP_MAX_CHARS", "220"))  # longest text synthesised in one model call
PAUSES = Pauses(
    clause=_env_float("CLAUSE_PAUSE_S", 0.15),
    colon=_env_float("COLON_PAUSE_S", 0.35),
    sentence=_env_float("SENTENCE_PAUSE_S", 0.45),
    exclamation=_env_float("EXCLAMATION_PAUSE_S", 0.5),
    question=_env_float("QUESTION_PAUSE_S", 0.55),
    ellipsis=_env_float("ELLIPSIS_PAUSE_S", 0.8),
    paragraph=_env_float("PARAGRAPH_PAUSE_S", 1.0),
    end=_env_float("END_PAUSE_S", 0.8),
)
LEAD_IN_S = _env_float("LEAD_IN_S", 0.1)
MP3_BITRATE = os.environ.get("MP3_BITRATE", "128k")
MAX_QUEUE = int(os.environ.get("MAX_QUEUE", "24"))
API_KEY = os.environ.get("API_KEY", "").strip()
LOUDNORM = os.environ.get("LOUDNORM", "1").strip() != "0"
TARGET_LUFS = _env_float("TARGET_LUFS", -16.0)
TRUE_PEAK_DB = _env_float("TRUE_PEAK_DB", -1.5)
HIGHPASS_HZ = int(_env_float("HIGHPASS_HZ", 60))
OUTPUT_GAIN_DB = _env_float("OUTPUT_GAIN_DB", 4)  # fallback when loudness normalisation is off or fails
CPU_THREADS = int(os.environ.get("KOKORO_CPU_THREADS", str(max(1, min(8, os.cpu_count() or 1)))))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("thorsten-kokoro")

torch.set_num_threads(CPU_THREADS)

app = Flask(__name__)

# -----------------------------------------------------------------------------
# Model loading (mirrors the official inference.py of Thorsten-Voice/Kokoro)
# -----------------------------------------------------------------------------
_pipeline = None
_voice = None
_infer_lock = threading.Lock()
_waiting = 0
_waiting_lock = threading.Lock()


def _checkpoint_files(epoch: str):
    if epoch in ("5", "default"):
        return "model.pth", "voices/thorsten.pt"
    return f"model_ep{epoch}.pth", f"voices/thorsten_ep{epoch}.pt"


def _load_pipeline():
    from kokoro import KModel, KPipeline

    model_file, voice_file = _checkpoint_files(CHECKPOINT)
    config_path = hf_hub_download(repo_id=REPO_ID, filename="config.json")
    model_path = hf_hub_download(repo_id=REPO_ID, filename=model_file)
    voice_path = hf_hub_download(repo_id=REPO_ID, filename=voice_file)

    kmodel = KModel(repo_id=BASE_REPO_ID, config=config_path, model=model_path).to("cpu").eval()
    pipeline = KPipeline(lang_code="d", repo_id=BASE_REPO_ID, model=kmodel)

    original_g2p = pipeline.g2p

    def patched_g2p(text):
        # The German G2P can emit the short-u symbol, which is not in Kokoro's vocab.
        phonemes, tokens = original_g2p(text)
        return phonemes.replace("ʏ", "y"), tokens

    pipeline.g2p = patched_g2p
    voice = torch.load(voice_path, map_location="cpu", weights_only=True)
    return pipeline, voice


# -----------------------------------------------------------------------------
# Synthesis + encoding
# -----------------------------------------------------------------------------
def _silence(seconds: float) -> np.ndarray:
    return np.zeros(max(0, int(SAMPLE_RATE * seconds)), dtype=np.float32)


def _render(text: str, speed: float) -> Optional[np.ndarray]:
    chunks = []
    for _, _, audio in _pipeline(text, voice=_voice, speed=speed):
        if audio is None:
            continue
        chunks.append(audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio))
    if not chunks:
        return None
    return np.concatenate(chunks).astype(np.float32)


def _trim_silence(samples: np.ndarray, threshold_db: float = -45.0) -> np.ndarray:
    """Cut the model's variable lead/tail silence so the inserted pauses alone set the rhythm."""
    frame = int(SAMPLE_RATE * 0.01)
    frames = samples.size // frame
    peak = float(np.max(np.abs(samples))) if samples.size else 0.0
    if frames == 0 or peak <= 0.0:
        return samples
    rms = np.sqrt(np.mean(samples[: frames * frame].reshape(frames, frame) ** 2, axis=1))
    active = np.nonzero(rms > peak * 10 ** (threshold_db / 20.0))[0]
    if active.size == 0:
        return samples
    start = max(0, active[0] * frame - int(SAMPLE_RATE * 0.03))
    end = min(samples.size, (active[-1] + 1) * frame + int(SAMPLE_RATE * 0.08))  # keep the natural decay
    return samples[start:end]


def _fade(samples: np.ndarray, seconds: float = 0.008) -> np.ndarray:
    n = min(int(SAMPLE_RATE * seconds), samples.size // 2)
    if n <= 0:
        return samples
    ramp = np.linspace(0.0, 1.0, n, dtype=np.float32)
    out = samples.copy()
    out[:n] *= ramp
    out[-n:] *= ramp[::-1]
    return out


def synthesize(text: str, speed: float) -> np.ndarray:
    segments = build_segments(normalize_text(text), PAUSES, GROUP_MAX_CHARS)
    if not segments:
        raise ValueError("Text is empty after normalization.")

    pieces = [_silence(LEAD_IN_S)]
    rendered = 0
    with _infer_lock:
        for segment in segments:
            audio = _render(segment.text, speed)
            if audio is None:
                log.warning("No audio for segment: %r", segment.text[:80])
                continue
            pieces.append(_fade(_trim_silence(audio)))
            pieces.append(_silence(segment.pause))
            rendered += 1
    if not rendered:
        raise RuntimeError("Model produced no audio.")
    return np.concatenate(pieces)


def _run_ffmpeg(samples: np.ndarray, args: list) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(SAMPLE_RATE), "-ac", "1", "-i", "pipe:0", *args],
        input=samples.astype(np.float32).tobytes(),
        capture_output=True,
        timeout=180,
    )


def _prefilter() -> str:
    return f"highpass=f={HIGHPASS_HZ}" if HIGHPASS_HZ > 0 else "anull"


def _loudnorm_chain(samples: np.ndarray) -> Optional[str]:
    """Two-pass EBU R128 normalisation as one linear gain, so every chunk plays equally loud."""
    target = f"I={TARGET_LUFS}:TP={TRUE_PEAK_DB}:LRA=20"
    proc = _run_ffmpeg(samples, ["-af", f"{_prefilter()},loudnorm={target}:print_format=json", "-f", "null", "-"])
    stderr = proc.stderr.decode(errors="ignore")
    start, end = stderr.rfind("{"), stderr.rfind("}")
    if proc.returncode != 0 or start < 0 or end < start:
        log.warning("loudnorm measurement failed: %s", stderr[-300:])
        return None
    try:
        measured = json.loads(stderr[start:end + 1])
        values = {key: float(measured[key]) for key in ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset")}
    except (KeyError, ValueError):
        log.warning("loudnorm measurement unreadable: %s", stderr[start:end + 1][:300])
        return None
    if not all(math.isfinite(v) for v in values.values()):
        return None  # e.g. clips too short to measure
    return (
        f"{_prefilter()},loudnorm={target}:measured_I={values['input_i']}:measured_TP={values['input_tp']}"
        f":measured_LRA={values['input_lra']}:measured_thresh={values['input_thresh']}"
        f":offset={values['target_offset']}:linear=true,aresample={SAMPLE_RATE}"
    )


def _fixed_gain(samples: np.ndarray) -> np.ndarray:
    gain = 10 ** (OUTPUT_GAIN_DB / 20.0)
    peak = float(np.max(np.abs(samples))) if samples.size else 0.0
    if peak * gain > 0.97:  # never clip
        gain = 0.97 / peak
    return np.clip(samples * gain, -1.0, 1.0).astype(np.float32)


def encode(samples: np.ndarray, fmt: str) -> bytes:
    chain = _loudnorm_chain(samples) if LOUDNORM else None
    if chain is None:
        samples, chain = _fixed_gain(samples), _prefilter()

    if fmt == "wav":
        proc = _run_ffmpeg(samples, ["-af", chain, "-ar", str(SAMPLE_RATE), "-f", "s16le", "-acodec", "pcm_s16le", "pipe:1"])
    else:
        proc = _run_ffmpeg(
            samples,
            ["-af", chain, "-ar", str(SAMPLE_RATE), "-codec:a", "libmp3lame", "-b:a", MP3_BITRATE, "-f", "mp3", "pipe:1"],
        )
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError(f"ffmpeg {fmt} encoding failed: {proc.stderr.decode(errors='ignore')[-300:]}")
    if fmt != "wav":
        return proc.stdout
    buf = BytesIO()
    sf.write(buf, np.frombuffer(proc.stdout, dtype=np.int16), SAMPLE_RATE, format="WAV", subtype="PCM_16")
    return buf.getvalue()


# -----------------------------------------------------------------------------
# HTTP API
# -----------------------------------------------------------------------------
def _authorized() -> bool:
    if not API_KEY:
        return True
    header = request.headers.get("Authorization", "")
    token = header[7:].strip() if header.lower().startswith("bearer ") else request.headers.get("X-API-Key", "")
    return token == API_KEY


@app.route("/health", methods=["GET"])
def health():
    ready = _pipeline is not None
    return jsonify({
        "status": "ok" if ready else "loading",
        "model_loaded": ready,
        "checkpoint": CHECKPOINT,
        "default_speed": DEFAULT_SPEED,
        "loudnorm": LOUDNORM,
        "sample_rate": SAMPLE_RATE,
        "queue": _waiting,
    }), (200 if ready else 503)


@app.route("/tts", methods=["POST"])
def tts():
    global _waiting
    if not _authorized():
        return jsonify({"error": "unauthorized"}), 401
    if _pipeline is None:
        return jsonify({"error": "model not loaded"}), 503

    payload = request.get_json(silent=True) or {}
    text = str(payload.get("text") or "").strip()
    if not text:
        return jsonify({"error": "text is required"}), 400
    if len(text) > MAX_TEXT_CHARS:
        return jsonify({"error": f"text too long (max {MAX_TEXT_CHARS} chars)"}), 413

    fmt = str(payload.get("format") or "mp3").lower()
    if fmt not in ("mp3", "wav"):
        return jsonify({"error": "format must be mp3 or wav"}), 400
    try:
        speed = float(payload.get("speed") or DEFAULT_SPEED)
    except (TypeError, ValueError):
        return jsonify({"error": "speed must be a number"}), 400
    speed = max(0.6, min(1.5, speed))

    with _waiting_lock:
        if _waiting >= MAX_QUEUE:
            return jsonify({"error": "queue full"}), 503, {"Retry-After": "5"}
        _waiting += 1
    started = time.time()
    try:
        samples = synthesize(text, speed)
        body = encode(samples, fmt)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        log.exception("synthesis failed")
        return jsonify({"error": f"synthesis failed: {exc}"}), 500
    finally:
        with _waiting_lock:
            _waiting -= 1

    duration = len(samples) / SAMPLE_RATE
    elapsed = time.time() - started
    log.info("tts ok: %d chars -> %.1fs audio in %.1fs (x%.1f realtime, %s)",
             len(text), duration, elapsed, duration / max(elapsed, 0.001), fmt)
    return Response(
        body,
        mimetype="audio/mpeg" if fmt == "mp3" else "audio/wav",
        headers={
            "X-Audio-Duration": f"{duration:.2f}",
            "X-Processing-Seconds": f"{elapsed:.2f}",
        },
    )


def _startup():
    global _pipeline, _voice
    started = time.time()
    log.info("Loading Thorsten-Voice Kokoro (checkpoint=%s, threads=%d)...", CHECKPOINT, CPU_THREADS)
    pipeline, voice = _load_pipeline()
    _pipeline, _voice = pipeline, voice
    # Warm-up so the first real request does not pay one-time costs.
    synthesize("Hallo, hier spricht Thorsten.", DEFAULT_SPEED)
    log.info("Model ready in %.1fs", time.time() - started)


def _network_selfcheck():
    """Log once whether Railway private networking works (names resolve, peers reachable)."""
    import socket
    import urllib.request

    time.sleep(5)
    own = os.environ.get("RAILWAY_PRIVATE_DOMAIN", "")
    log.info("selfcheck RAILWAY_PRIVATE_DOMAIN=%r", own)
    for host in filter(None, [own]):
        try:
            addrs = sorted({info[4][0] for info in socket.getaddrinfo(host, None)})
            log.info("selfcheck dns %s -> %s", host, addrs)
        except Exception as exc:
            log.warning("selfcheck dns %s failed: %s", host, exc)
    # Call ourselves over the private network: proves the [::] bind is reachable for the backend.
    port = os.environ.get("PORT", "8080")
    peer_url = os.environ.get("SELFCHECK_PEER_URL", f"http://{own}:{port}/health" if own else "")
    if not peer_url:
        return
    try:
        with urllib.request.urlopen(peer_url, timeout=5) as resp:
            log.info("selfcheck peer %s -> HTTP %s", peer_url, resp.status)
    except Exception as exc:
        log.warning("selfcheck peer %s failed: %s", peer_url, exc)


_startup()
if os.environ.get("NET_SELFCHECK", "1") != "0" and os.environ.get("RAILWAY_ENVIRONMENT_ID"):
    threading.Thread(target=_network_selfcheck, daemon=True).start()

if __name__ == "__main__":
    app.run(host="::", port=int(os.environ.get("PORT", "8080")))
