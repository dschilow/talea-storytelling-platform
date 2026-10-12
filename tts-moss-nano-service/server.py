"""MOSS-TTS-Nano TTS service.

Self-hosted multilingual TTS on CPU (ONNX Runtime). Model: https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Nano
(0.1B parameters, Apache 2.0, 48 kHz). MOSS-TTS-Nano has no German built-in voices, so every voice is a voice
clone of a short reference clip from voices/<name>.wav (the default is the CC-licensed Thorsten-Voice dataset).

Endpoints
  GET  /health        readiness (200 only once the model is loaded)
  GET  /voices        voice ids found in voices/
  POST /tts           {"text": str, "voice"?: str, "seed"?: int, "format"?: "mp3"|"wav"} -> audio bytes

Same HTTP contract, text preparation (textprep.py) and audio post-processing (audioprep.py) as the Thorsten/Kokoro
service, so both providers can be compared one to one in the story player.
"""
import logging
import os
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import soundfile as sf
from flask import Flask, Response, jsonify, request

from audioprep import LOUDNORM, assemble, encode, env_float, pauses_from_env, silence
from textprep import build_segments, normalize_text

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
MODEL_DIR = Path(os.environ.get("MOSS_MODEL_DIR", "/opt/moss-models"))
VOICES_DIR = Path(os.environ.get("MOSS_VOICES_DIR", str(Path(__file__).parent / "voices")))
DEFAULT_VOICE = os.environ.get("MOSS_DEFAULT_VOICE", "thorsten_neutral").strip()
SAMPLE_MODE = os.environ.get("MOSS_SAMPLE_MODE", "fixed").strip()  # greedy | fixed | full (see upstream README)
STREAMING_DECODE = os.environ.get("MOSS_STREAMING_DECODE", "0").strip() == "1"  # measured ~2x slower on CPU
MAX_NEW_FRAMES = int(os.environ.get("MOSS_MAX_NEW_FRAMES", "375"))  # 12.5 frames per second of audio
FRAMES_PER_CHAR_CAP = env_float("MOSS_FRAMES_PER_CHAR_CAP", 2.0)  # German speech needs ~1 frame per character
MAX_TEXT_TOKENS = int(os.environ.get("MOSS_MAX_TEXT_TOKENS", "75"))  # upstream default for chunked cloning
MAX_RETRIES = int(os.environ.get("MOSS_MAX_RETRIES", "2"))  # re-roll a chunk that never finds its end
CHUNK_PAUSE_S = env_float("MOSS_CHUNK_PAUSE_S", 0.15)
MAX_TEXT_CHARS = int(os.environ.get("MAX_TEXT_CHARS", "6000"))
GROUP_MAX_CHARS = int(os.environ.get("GROUP_MAX_CHARS", "180"))  # longest text synthesised as one segment
PAUSES = pauses_from_env()
MAX_QUEUE = int(os.environ.get("MAX_QUEUE", "24"))
API_KEY = os.environ.get("API_KEY", "").strip()
# The decode loop is sequential and small: 1 -> 4 threads helps (RTF 1.4 -> 0.8), beyond 4 it only adds contention.
CPU_THREADS = int(os.environ.get("MOSS_CPU_THREADS", str(max(1, min(4, os.cpu_count() or 1)))))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("moss-nano")

WARMUP_TEXT = (
    "Es war einmal ein kleiner Fuchs, der lebte am Rand eines tiefen, dunklen Waldes. "
    "Jeden Abend schaute er zu den Sternen hinauf."
)

app = Flask(__name__)

_runtime = None
_sample_rate = 48000
_voices: Dict[str, List[List[int]]] = {}
_infer_lock = threading.Lock()
_waiting = 0
_waiting_lock = threading.Lock()


# -----------------------------------------------------------------------------
# Model loading
# -----------------------------------------------------------------------------
def _build_runtime_class():
    import torch
    import torchaudio
    from onnx_tts_runtime import OnnxTtsRuntime

    class Runtime(OnnxTtsRuntime):
        def _load_reference_audio(self, reference_audio_path):
            # Same conversion as upstream, but read with soundfile: torchaudio.load needs an audio backend.
            data, sample_rate = sf.read(str(reference_audio_path), dtype="float32", always_2d=True)
            waveform = torch.from_numpy(np.ascontiguousarray(data.T))
            codec = self.codec_meta["codec_config"]
            target_rate, target_channels = int(codec["sample_rate"]), int(codec["channels"])
            if sample_rate != target_rate:
                waveform = torchaudio.functional.resample(waveform, sample_rate, target_rate)
            if waveform.shape[0] != target_channels:
                waveform = waveform.mean(dim=0, keepdim=True).repeat(target_channels, 1)
            return waveform.unsqueeze(0).numpy().astype(np.float32, copy=False)

    return Runtime


def _load_voices(runtime) -> Dict[str, List[List[int]]]:
    voices: Dict[str, List[List[int]]] = {}
    for path in sorted(VOICES_DIR.glob("*.wav")):
        started = time.time()
        voices[path.stem] = runtime.encode_reference_audio(path)
        log.info("voice %s: %d reference frames (%.1fs)", path.stem, len(voices[path.stem]), time.time() - started)
    if not voices:
        raise RuntimeError(f"No reference clips (*.wav) found in {VOICES_DIR}")
    return voices


# -----------------------------------------------------------------------------
# Synthesis
# -----------------------------------------------------------------------------
def _frame_cap(text: str) -> int:
    return min(MAX_NEW_FRAMES, max(60, int(len(text) * FRAMES_PER_CHAR_CAP) + 30))


def _mono(waveform: np.ndarray) -> np.ndarray:
    audio = np.asarray(waveform, dtype=np.float32)
    return audio.mean(axis=1) if audio.ndim == 2 else audio


def _render_chunk(text: str, codes: List[List[int]]) -> Optional[np.ndarray]:
    """One model call. A chunk that hits the frame cap never found its end token (rambling): re-roll it."""
    cap = _frame_cap(text)
    _runtime.manifest["generation_defaults"]["max_new_frames"] = cap
    best = None
    for attempt in range(1, MAX_RETRIES + 2):
        result = _runtime.synthesize_single_chunk(text=text, prompt_audio_codes=codes, streaming=STREAMING_DECODE)
        audio = _mono(result["waveform"])
        best = audio if audio.size else best
        if len(result["generated_frames"]) < cap and audio.size:
            return audio
        log.warning("chunk hit frame cap %d (attempt %d/%d): %r", cap, attempt, MAX_RETRIES + 1, text[:80])
    return best


def _render(text: str, codes: List[List[int]]) -> Optional[np.ndarray]:
    pieces: List[np.ndarray] = []
    for chunk in _runtime.split_voice_clone_text(text, max_tokens=MAX_TEXT_TOKENS):
        audio = _render_chunk(chunk, codes)
        if audio is None or audio.size == 0:
            continue
        if pieces:
            pieces.append(silence(CHUNK_PAUSE_S, _sample_rate))
        pieces.append(audio)
    return np.concatenate(pieces).astype(np.float32) if pieces else None


def synthesize(text: str, voice: str, seed: Optional[int]) -> np.ndarray:
    segments = build_segments(normalize_text(text), PAUSES, GROUP_MAX_CHARS)
    if not segments:
        raise ValueError("Text is empty after normalization.")
    codes = _voices[voice]
    with _infer_lock:
        if seed is not None:
            _runtime.rng = np.random.default_rng(seed)
        return assemble(segments, lambda segment_text: _render(segment_text, codes), _sample_rate)


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
    ready = _runtime is not None
    return jsonify({
        "status": "ok" if ready else "loading",
        "model_loaded": ready,
        "voices": sorted(_voices),
        "default_voice": DEFAULT_VOICE,
        "sample_mode": SAMPLE_MODE,
        "streaming_decode": STREAMING_DECODE,
        "cpu_threads": CPU_THREADS,
        "loudnorm": LOUDNORM,
        "sample_rate": _sample_rate,
        "queue": _waiting,
    }), (200 if ready else 503)


@app.route("/voices", methods=["GET"])
def voices():
    if not _authorized():
        return jsonify({"error": "unauthorized"}), 401
    return jsonify({"voices": sorted(_voices), "defaultVoice": DEFAULT_VOICE})


@app.route("/tts", methods=["POST"])
def tts():
    global _waiting
    if not _authorized():
        return jsonify({"error": "unauthorized"}), 401
    if _runtime is None:
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
    voice = str(payload.get("voice") or DEFAULT_VOICE)
    if voice not in _voices:
        return jsonify({"error": f"unknown voice '{voice}'", "voices": sorted(_voices)}), 400
    seed = payload.get("seed")
    if seed is not None:
        try:
            seed = int(seed)
        except (TypeError, ValueError):
            return jsonify({"error": "seed must be an integer"}), 400

    with _waiting_lock:
        if _waiting >= MAX_QUEUE:
            return jsonify({"error": "queue full"}), 503, {"Retry-After": "5"}
        _waiting += 1
    started = time.time()
    try:
        samples = synthesize(text, voice, seed)
        body = encode(samples, fmt, _sample_rate)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        log.exception("synthesis failed")
        return jsonify({"error": f"synthesis failed: {exc}"}), 500
    finally:
        with _waiting_lock:
            _waiting -= 1

    duration = len(samples) / _sample_rate
    elapsed = time.time() - started
    log.info("tts ok: %d chars -> %.1fs audio in %.1fs (x%.2f realtime, %s, voice=%s)",
             len(text), duration, elapsed, duration / max(elapsed, 0.001), fmt, voice)
    return Response(
        body,
        mimetype="audio/mpeg" if fmt == "mp3" else "audio/wav",
        headers={
            "X-Audio-Duration": f"{duration:.2f}",
            "X-Processing-Seconds": f"{elapsed:.2f}",
        },
    )


def _startup():
    global _runtime, _voices, _sample_rate
    started = time.time()
    log.info("Loading MOSS-TTS-Nano ONNX (threads=%d, sample_mode=%s, streaming=%s)...",
             CPU_THREADS, SAMPLE_MODE, STREAMING_DECODE)
    runtime = _build_runtime_class()(
        model_dir=MODEL_DIR,
        thread_count=CPU_THREADS,
        max_new_frames=MAX_NEW_FRAMES,
        do_sample=SAMPLE_MODE != "greedy",
        sample_mode=SAMPLE_MODE,
        output_dir=os.environ.get("MOSS_OUTPUT_DIR", "/tmp/moss-output"),
    )
    _sample_rate = int(runtime.codec_meta["codec_config"]["sample_rate"])
    voices_loaded = _load_voices(runtime)
    if DEFAULT_VOICE not in voices_loaded:
        raise RuntimeError(f"MOSS_DEFAULT_VOICE '{DEFAULT_VOICE}' not in {sorted(voices_loaded)}")
    _runtime, _voices = runtime, voices_loaded
    # Warm-up so the first real request does not pay one-time costs; doubles as a speed check on this host.
    warm_started = time.time()
    warm_samples = synthesize(WARMUP_TEXT, DEFAULT_VOICE, 1)
    warm_elapsed = time.time() - warm_started
    log.info("warm-up: %.1fs audio in %.1fs (x%.2f realtime, %d threads)",
             len(warm_samples) / _sample_rate, warm_elapsed,
             len(warm_samples) / _sample_rate / max(warm_elapsed, 0.001), CPU_THREADS)
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
