"""Thorsten-Voice (Kokoro) TTS service.

Self-hosted German TTS on CPU. Model: https://huggingface.co/Thorsten-Voice/Kokoro
(fine-tune of Kokoro-82M on the public-domain Thorsten-Voice dataset, Apache 2.0).

Endpoints
  GET  /health        readiness (200 only once the model is loaded)
  POST /tts           {"text": str, "speed"?: float, "format"?: "mp3"|"wav"} -> audio bytes
"""
import logging
import os
import re
import subprocess
import threading
import time
import unicodedata
from io import BytesIO

import numpy as np
import soundfile as sf
import torch
from flask import Flask, Response, jsonify, request
from huggingface_hub import hf_hub_download

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
REPO_ID = "Thorsten-Voice/Kokoro"
BASE_REPO_ID = "hexgrad/Kokoro-82M"
SAMPLE_RATE = 24000

CHECKPOINT = os.environ.get("KOKORO_EPOCH", "5").strip()  # 1-10, 5 = repo default
DEFAULT_SPEED = float(os.environ.get("KOKORO_DEFAULT_SPEED", "1.0"))
MAX_TEXT_CHARS = int(os.environ.get("MAX_TEXT_CHARS", "6000"))
GROUP_MAX_CHARS = int(os.environ.get("GROUP_MAX_CHARS", "240"))  # sentences are grouped up to this size
SENTENCE_PAUSE_S = float(os.environ.get("SENTENCE_PAUSE_S", "0.16"))
PARAGRAPH_PAUSE_S = float(os.environ.get("PARAGRAPH_PAUSE_S", "0.5"))
MP3_BITRATE = os.environ.get("MP3_BITRATE", "128k")
MAX_QUEUE = int(os.environ.get("MAX_QUEUE", "24"))
API_KEY = os.environ.get("API_KEY", "").strip()
OUTPUT_GAIN_DB = float(os.environ.get("OUTPUT_GAIN_DB", "4"))  # raw Kokoro output is quiet; fixed gain keeps chunks consistent
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
# Text preparation
# -----------------------------------------------------------------------------
_INLINE_TAG_RE = re.compile(r"\[[A-Za-z][A-Za-z \-]{1,24}\]")  # e.g. [pause], [laugh] (xAI speech tags)
_WRAP_TAG_RE = re.compile(r"</?[A-Za-z][A-Za-z\-]{1,24}>")  # e.g. <whisper>...</whisper>
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_THOUSANDS_RE = re.compile(r"(?<![\d.,])(\d{1,3}(?:\.\d{3})+)(?![\d])")
_DECIMAL_RE = re.compile(r"(?<![\d])(\d+),(\d+)(?![\d])")
_NUMBER_RE = re.compile(r"(?<![\w])\d+(?![\w])")
_YEAR_CONTEXT_RE = re.compile(
    r"\b(Jahr|Jahre|Jahres|Jahren|im|seit|bis|ab|von|um|vor|nach|anno|Anno|Ende|Anfang|Mitte)\s+(1[1-9]\d\d|20\d\d)(?!\d)"
)
_MONTHS = "Januar|Februar|M\u00e4rz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember"
_DATE_RE = re.compile(r"(?<![\d])(\d{1,2})\.\s*(" + _MONTHS + r")\b")
_ORDINAL_RE = re.compile(r"\b(?i:(am|im|zum|vom|beim|zur|den|dem))\s+(\d{1,2})\.(?=\s+[A-Z\u00c4\u00d6\u00dc])")

try:
    from num2words import num2words
except Exception:  # pragma: no cover - optional dependency
    num2words = None


def _spell_number(match: "re.Match[str]") -> str:
    raw = match.group(0)
    try:
        value = int(raw)
        if num2words is None:
            return raw
        return num2words(value, lang="de")
    except Exception:
        return raw


def _spell_decimal(match: "re.Match[str]") -> str:
    if num2words is None:
        return match.group(0)
    try:
        whole = num2words(int(match.group(1)), lang="de")
        frac = " ".join(num2words(int(d), lang="de") for d in match.group(2))
        return f"{whole} Komma {frac}"
    except Exception:
        return match.group(0)


def _ordinal(value: int, suffix: str = "n") -> str:
    if num2words is None:
        return str(value)
    try:
        base = num2words(value, lang="de", to="ordinal")  # e.g. "zweite"
        return base + suffix if not base.endswith("n") else base
    except Exception:
        return str(value)


def _cardinal_thousands(match: "re.Match[str]") -> str:
    digits = match.group(1).replace(".", "")
    try:
        return num2words(int(digits), lang="de") if num2words else digits
    except Exception:
        return digits


def _year_in_context(match: "re.Match[str]") -> str:
    try:
        return f"{match.group(1)} {num2words(int(match.group(2)), lang='de', to='year')}"
    except Exception:
        return match.group(0)


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFC", text or "")
    text = _CONTROL_RE.sub("", text)
    text = _INLINE_TAG_RE.sub(" ", text)
    text = _WRAP_TAG_RE.sub("", text)
    # Quotes: German/French/typographic -> plain ASCII
    text = re.sub("[“”„‟«»″〝〞〟＂]", '"', text)
    text = re.sub("[‘’‚‛‹›′＇]", "'", text)
    # Dashes become a soft pause, ellipsis stays a pause
    text = re.sub(r"\s*[–—―]\s*", ", ", text)
    text = re.sub(r"\s+-\s+", ", ", text)
    text = text.replace("…", "...")
    text = text.replace("&", " und ").replace("%", " Prozent").replace("€", " Euro")
    # Numbers -> German words
    text = _DATE_RE.sub(lambda m: f"{_ordinal(int(m.group(1)))} {m.group(2)}", text)
    text = _ORDINAL_RE.sub(lambda m: f"{m.group(1)} {_ordinal(int(m.group(2)))}", text)
    text = _THOUSANDS_RE.sub(_cardinal_thousands, text)
    text = _YEAR_CONTEXT_RE.sub(_year_in_context, text)
    text = _DECIMAL_RE.sub(_spell_decimal, text)
    text = _NUMBER_RE.sub(_spell_number, text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    return text.strip()


_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?…])[\"')\]]*\s+")


def _split_long(sentence: str, limit: int):
    """Split an over-long sentence at clause boundaries, then at spaces."""
    if len(sentence) <= limit:
        return [sentence]
    parts = re.split(r"(?<=[,;:])\s+", sentence)
    out, buf = [], ""
    for part in parts:
        candidate = f"{buf} {part}".strip() if buf else part
        if len(candidate) <= limit:
            buf = candidate
            continue
        if buf:
            out.append(buf)
        if len(part) <= limit:
            buf = part
            continue
        words, cur = part.split(" "), ""
        for word in words:
            nxt = f"{cur} {word}".strip()
            if len(nxt) > limit and cur:
                out.append(cur)
                cur = word
            else:
                cur = nxt
        buf = cur
    if buf:
        out.append(buf)
    return out


def build_segments(text: str):
    """Return [(text, pause_after_seconds)] with sentences grouped to GROUP_MAX_CHARS."""
    segments = []
    paragraphs = [p.strip() for p in re.split(r"\n{1,}", text) if p.strip()]
    for p_index, paragraph in enumerate(paragraphs):
        sentences = []
        for sentence in _SENTENCE_SPLIT_RE.split(paragraph):
            sentence = sentence.strip()
            if sentence:
                sentences.extend(_split_long(sentence, GROUP_MAX_CHARS))
        group = ""
        paragraph_segments = []
        for sentence in sentences:
            candidate = f"{group} {sentence}".strip() if group else sentence
            if len(candidate) <= GROUP_MAX_CHARS:
                group = candidate
            else:
                if group:
                    paragraph_segments.append(group)
                group = sentence
        if group:
            paragraph_segments.append(group)
        for s_index, segment in enumerate(paragraph_segments):
            last_in_paragraph = s_index == len(paragraph_segments) - 1
            last_overall = last_in_paragraph and p_index == len(paragraphs) - 1
            pause = 0.0 if last_overall else (PARAGRAPH_PAUSE_S if last_in_paragraph else SENTENCE_PAUSE_S)
            segments.append((segment, pause))
    return segments


# -----------------------------------------------------------------------------
# Synthesis + encoding
# -----------------------------------------------------------------------------
def synthesize(text: str, speed: float) -> np.ndarray:
    segments = build_segments(normalize_text(text))
    if not segments:
        raise ValueError("Text is empty after normalization.")

    pieces = []
    with _infer_lock:
        for segment_text, pause in segments:
            chunks = []
            for _, _, audio in _pipeline(segment_text, voice=_voice, speed=speed):
                if audio is None:
                    continue
                chunks.append(audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio))
            if not chunks:
                log.warning("No audio for segment: %r", segment_text[:80])
                continue
            pieces.append(np.concatenate(chunks).astype(np.float32))
            if pause > 0:
                pieces.append(np.zeros(int(SAMPLE_RATE * pause), dtype=np.float32))
    if not pieces:
        raise RuntimeError("Model produced no audio.")
    return np.concatenate(pieces)


def encode(samples: np.ndarray, fmt: str) -> bytes:
    gain = 10 ** (OUTPUT_GAIN_DB / 20.0)
    peak = float(np.max(np.abs(samples))) if samples.size else 0.0
    if peak * gain > 0.97:  # never clip
        gain = 0.97 / peak
    pcm = (np.clip(samples * gain, -1.0, 1.0) * 32767.0).astype(np.int16)
    if fmt == "wav":
        buf = BytesIO()
        sf.write(buf, pcm, SAMPLE_RATE, format="WAV", subtype="PCM_16")
        return buf.getvalue()
    proc = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-f", "s16le", "-ar", str(SAMPLE_RATE), "-ac", "1", "-i", "pipe:0",
            "-codec:a", "libmp3lame", "-b:a", MP3_BITRATE, "-f", "mp3", "pipe:1",
        ],
        input=pcm.tobytes(),
        capture_output=True,
        timeout=120,
    )
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError(f"ffmpeg mp3 encoding failed: {proc.stderr.decode(errors='ignore')[:300]}")
    return proc.stdout


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


_startup()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
