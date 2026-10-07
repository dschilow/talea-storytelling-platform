"""Thorsten-Voice (Kokoro) TTS service.

Self-hosted German TTS on CPU. Model: https://huggingface.co/Thorsten-Voice/Kokoro
(fine-tune of Kokoro-82M on the public-domain Thorsten-Voice dataset, Apache 2.0).

Endpoints
  GET  /health        readiness (200 only once the model is loaded)
  POST /tts           {"text": str, "speed"?: float, "format"?: "mp3"|"wav"} -> audio bytes

Tuned for children's stories: slower default speed, one model call per sentence with
punctuation-dependent pauses, and loudness-normalised output.
"""
import logging
import os
import threading
import time
from typing import Optional

import numpy as np
import torch
from flask import Flask, Response, jsonify, request
from huggingface_hub import hf_hub_download

from audioprep import LOUDNORM, assemble, encode, env_float, pauses_from_env
from textprep import build_segments, normalize_text

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
REPO_ID = "Thorsten-Voice/Kokoro"
BASE_REPO_ID = "hexgrad/Kokoro-82M"
SAMPLE_RATE = 24000

CHECKPOINT = os.environ.get("KOKORO_EPOCH", "5").strip()  # 1-10, 5 = repo default (judged most natural)
DEFAULT_SPEED = env_float("KOKORO_DEFAULT_SPEED", 0.85)  # 1.0 is too hurried for children's stories
MAX_TEXT_CHARS = int(os.environ.get("MAX_TEXT_CHARS", "6000"))
GROUP_MAX_CHARS = int(os.environ.get("GROUP_MAX_CHARS", "220"))  # longest text synthesised in one model call
PAUSES = pauses_from_env()
MAX_QUEUE = int(os.environ.get("MAX_QUEUE", "24"))
API_KEY = os.environ.get("API_KEY", "").strip()
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
# Synthesis
# -----------------------------------------------------------------------------
def _render(text: str, speed: float) -> Optional[np.ndarray]:
    chunks = []
    for _, _, audio in _pipeline(text, voice=_voice, speed=speed):
        if audio is None:
            continue
        chunks.append(audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio))
    if not chunks:
        return None
    return np.concatenate(chunks).astype(np.float32)


def synthesize(text: str, speed: float) -> np.ndarray:
    segments = build_segments(normalize_text(text), PAUSES, GROUP_MAX_CHARS)
    if not segments:
        raise ValueError("Text is empty after normalization.")
    with _infer_lock:
        return assemble(segments, lambda segment_text: _render(segment_text, speed), SAMPLE_RATE)


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
        body = encode(samples, fmt, SAMPLE_RATE)
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
