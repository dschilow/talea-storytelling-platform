"""Thorsten-Voice CosyVoice3 TTS worker (GPU).

Model: https://huggingface.co/Thorsten-Voice/CosyVoice3 (fine-tune of Fun-CosyVoice3-0.5B-2512
on the public-domain Thorsten-Voice dataset, Apache 2.0). Uses the same text preparation,
pauses and loudness normalisation as the Kokoro service, so both voices compare fairly.

WORKER_MODE=queue  RunPod serverless queue handler:
                   input {"text", "speed"?, "format"?} -> {"audio_base64", "mime_type", "output_format", "duration"}
WORKER_MODE=http   HTTP server with the Kokoro contract (local tests, RunPod load balancer):
                   GET /health, GET /ping, POST /tts {"text", "speed"?, "format"?} -> audio bytes
"""
import base64
import logging
import os
import threading
import time
from typing import Optional, Tuple

import numpy as np

from audioprep import LOUDNORM, assemble, encode, env_float, pauses_from_env
from textprep import build_segments, normalize_text

BASE_REPO_ID = "FunAudioLLM/Fun-CosyVoice3-0.5B-2512"
THORSTEN_REPO_ID = "Thorsten-Voice/CosyVoice3"
# Only what SFT inference needs; llm.pt and flow.pt come from the Thorsten fine-tune.
BASE_FILES = [
    "cosyvoice3.yaml", "config.json", "configuration.json", "campplus.onnx",
    "speech_tokenizer_v3.onnx", "hift.pt", "CosyVoice-BlankEN/*",
]
THORSTEN_FILES = ["llm.pt", "flow.pt", "spk2info.pt"]
READY_MARKER = ".thorsten-ready"
INSTRUCT = "You are a helpful assistant.<|endofprompt|>"  # prompt used by the fine-tune's infer_thorsten.py

WORKER_MODE = os.environ.get("WORKER_MODE", "queue").strip().lower()
SPEAKER = os.environ.get("COSYVOICE_SPEAKER", "thorsten").strip()
DEFAULT_SPEED = env_float("COSYVOICE_DEFAULT_SPEED", 1.0)
FP16 = os.environ.get("COSYVOICE_FP16", "1").strip() != "0"
MAX_TEXT_CHARS = int(os.environ.get("MAX_TEXT_CHARS", "6000"))
GROUP_MAX_CHARS = int(os.environ.get("GROUP_MAX_CHARS", "220"))
PAUSES = pauses_from_env()
API_KEY = os.environ.get("API_KEY", "").strip()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("thorsten-cosyvoice3")

_model = None
_infer_lock = threading.Lock()


def default_model_dir() -> str:
    configured = os.environ.get("MODEL_DIR", "").strip()
    if configured:
        return configured
    baked = "/opt/models/thorsten-cosyvoice3"
    if os.path.exists(os.path.join(baked, READY_MARKER)) or not os.path.isdir("/runpod-volume"):
        return baked
    return "/runpod-volume/thorsten-cosyvoice3"  # network volume keeps the 5 GB download across cold starts


def ensure_model(model_dir: str) -> None:
    if os.path.exists(os.path.join(model_dir, READY_MARKER)):
        return
    from huggingface_hub import snapshot_download

    log.info("Downloading %s + %s into %s ...", BASE_REPO_ID, THORSTEN_REPO_ID, model_dir)
    snapshot_download(BASE_REPO_ID, local_dir=model_dir, allow_patterns=BASE_FILES)
    snapshot_download(THORSTEN_REPO_ID, local_dir=model_dir, allow_patterns=THORSTEN_FILES)
    open(os.path.join(model_dir, READY_MARKER), "w").close()


def load_model(model_dir: str):
    import torch
    from cosyvoice.cli.cosyvoice import CosyVoice3

    model = CosyVoice3(model_dir, fp16=FP16 and torch.cuda.is_available())
    if SPEAKER not in model.list_available_spks():
        raise RuntimeError(f"speaker {SPEAKER!r} not in spk2info ({model.list_available_spks()})")

    prompt_token, prompt_token_len = model.frontend._extract_text_token(INSTRUCT)
    original_frontend_sft = model.frontend.frontend_sft

    def frontend_sft(tts_text, spk_id):
        model_input = original_frontend_sft(tts_text, spk_id)
        model_input["prompt_text"] = prompt_token
        model_input["prompt_text_len"] = prompt_token_len
        return model_input

    model.frontend.frontend_sft = frontend_sft
    return model


def _render(text: str, speed: float) -> Optional[np.ndarray]:
    import torch

    # text_frontend=False: our German normalisation already ran; CosyVoice's would treat it as English.
    outputs = [out["tts_speech"] for out in _model.inference_sft(text, SPEAKER, stream=False, speed=speed, text_frontend=False)]
    if not outputs:
        return None
    return torch.cat(outputs, dim=1).squeeze(0).float().cpu().numpy()


def synthesize(text: str, speed: float, fmt: str) -> Tuple[bytes, float]:
    segments = build_segments(normalize_text(text), PAUSES, GROUP_MAX_CHARS)
    if not segments:
        raise ValueError("Text is empty after normalization.")
    with _infer_lock:
        samples = assemble(segments, lambda segment_text: _render(segment_text, speed), _model.sample_rate)
    return encode(samples, fmt, _model.sample_rate), len(samples) / _model.sample_rate


def parse_request(payload: dict) -> Tuple[str, float, str]:
    text = str(payload.get("text") or "").strip()
    if not text:
        raise ValueError("text is required")
    if len(text) > MAX_TEXT_CHARS:
        raise ValueError(f"text too long (max {MAX_TEXT_CHARS} chars)")
    fmt = str(payload.get("format") or "mp3").lower()
    if fmt not in ("mp3", "wav"):
        raise ValueError("format must be mp3 or wav")
    try:
        speed = float(payload.get("speed") or DEFAULT_SPEED)
    except (TypeError, ValueError):
        raise ValueError("speed must be a number")
    return text, max(0.6, min(1.5, speed)), fmt


def _timed_synthesize(text: str, speed: float, fmt: str) -> Tuple[bytes, float, float]:
    started = time.time()
    body, duration = synthesize(text, speed, fmt)
    elapsed = time.time() - started
    log.info("tts ok: %d chars -> %.1fs audio in %.1fs (x%.1f realtime, %s)",
             len(text), duration, elapsed, duration / max(elapsed, 0.001), fmt)
    return body, duration, elapsed


# -----------------------------------------------------------------------------
# RunPod queue mode
# -----------------------------------------------------------------------------
def handler(job: dict) -> dict:
    try:
        text, speed, fmt = parse_request(job.get("input") or {})
        body, duration, elapsed = _timed_synthesize(text, speed, fmt)
    except ValueError as exc:
        return {"error": str(exc)}
    except Exception as exc:
        log.exception("synthesis failed")
        return {"error": f"synthesis failed: {exc}"}
    return {
        "audio_base64": base64.b64encode(body).decode("ascii"),
        "mime_type": "audio/mpeg" if fmt == "mp3" else "audio/wav",
        "output_format": fmt,
        "duration": round(duration, 2),
        "processing_seconds": round(elapsed, 2),
    }


# -----------------------------------------------------------------------------
# HTTP mode
# -----------------------------------------------------------------------------
def create_app():
    from flask import Flask, Response, jsonify, request

    app = Flask(__name__)

    def authorized() -> bool:
        if not API_KEY:
            return True
        header = request.headers.get("Authorization", "")
        token = header[7:].strip() if header.lower().startswith("bearer ") else request.headers.get("X-API-Key", "")
        return token == API_KEY

    @app.route("/ping", methods=["GET"])
    @app.route("/health", methods=["GET"])
    def health():
        ready = _model is not None
        return jsonify({
            "status": "ok" if ready else "loading",
            "model_loaded": ready,
            "speaker": SPEAKER,
            "default_speed": DEFAULT_SPEED,
            "loudnorm": LOUDNORM,
        }), (200 if ready else 503)

    @app.route("/tts", methods=["POST"])
    def tts():
        if not authorized():
            return jsonify({"error": "unauthorized"}), 401
        if _model is None:
            return jsonify({"error": "model not loaded"}), 503
        try:
            text, speed, fmt = parse_request(request.get_json(silent=True) or {})
            body, duration, elapsed = _timed_synthesize(text, speed, fmt)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        except Exception as exc:
            log.exception("synthesis failed")
            return jsonify({"error": f"synthesis failed: {exc}"}), 500
        return Response(
            body,
            mimetype="audio/mpeg" if fmt == "mp3" else "audio/wav",
            headers={"X-Audio-Duration": f"{duration:.2f}", "X-Processing-Seconds": f"{elapsed:.2f}"},
        )

    return app


def main() -> None:
    global _model
    started = time.time()
    model_dir = default_model_dir()
    ensure_model(model_dir)
    _model = load_model(model_dir)
    _timed_synthesize("Hallo, hier spricht Thorsten.", DEFAULT_SPEED, "mp3")  # warm-up
    log.info("Model ready in %.1fs (dir=%s, fp16=%s, mode=%s)", time.time() - started, model_dir, FP16, WORKER_MODE)

    if WORKER_MODE == "http":
        create_app().run(host="::", port=int(os.environ.get("PORT", "80")), threaded=True)
        return
    import runpod

    runpod.serverless.start({"handler": handler})


if __name__ == "__main__":
    main()
