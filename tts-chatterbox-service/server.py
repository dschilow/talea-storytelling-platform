import io
import os
import re
import sys
import time
import uuid
import base64
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
import soundfile as sf
from flask import Flask, jsonify, request, send_file

# -----------------------------------------------------------------------------
# Runtime configuration
# -----------------------------------------------------------------------------
DEFAULT_MODEL = os.environ.get("CHATTERBOX_MODEL", "multilingual").strip().lower()  # multilingual|turbo
DEFAULT_LANGUAGE_ID = os.environ.get("CHATTERBOX_DEFAULT_LANGUAGE", "de").strip().lower()
DEVICE = os.environ.get("CHATTERBOX_DEVICE", "cpu").strip().lower()
MAX_CHUNK_CHARS = int(os.environ.get("MAX_CHUNK_CHARS", "280"))
MAX_PARALLEL_CHUNKS = int(os.environ.get("MAX_PARALLEL_CHUNKS", "1"))
JOB_WORKERS = int(os.environ.get("JOB_WORKERS", "2"))
JOB_TTL_SECONDS = int(os.environ.get("JOB_TTL_SECONDS", "1200"))

# Keep CPU usage deterministic-ish on small instances
os.environ.setdefault("OMP_NUM_THREADS", os.environ.get("OMP_NUM_THREADS", "1"))
os.environ.setdefault("MKL_NUM_THREADS", os.environ.get("MKL_NUM_THREADS", "1"))
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

app = Flask(__name__)

# Async job registry
_jobs = {}
_jobs_lock = threading.Lock()
_job_executor = ThreadPoolExecutor(max_workers=JOB_WORKERS, thread_name_prefix="chbox-job")

# Global model cache
_model = None
_model_name = None
_model_lock = threading.Lock()


def _preprocess_text(text: str) -> str:
    text = (text or "").strip()
    if not text:
        return ""
    text = text.replace("\u201e", '"').replace("\u201c", '"').replace("\u201d", '"')
    text = text.replace("\u00ab", '"').replace("\u00bb", '"').replace("\u2039", '"').replace("\u203a", '"')
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _split_chunks(text: str, max_chars: int = MAX_CHUNK_CHARS):
    if len(text) <= max_chars:
        return [text]

    chunks = []
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    for para in paragraphs:
        if len(para) <= max_chars:
            chunks.append(para)
            continue

        sentences = re.split(r"(?<=[.!?])\s+", para)
        current = ""
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            if not current:
                current = sentence
                continue
            if len(current) + len(sentence) + 1 <= max_chars:
                current = f"{current} {sentence}"
            else:
                chunks.append(current.strip())
                current = sentence
        if current.strip():
            chunks.append(current.strip())

    return chunks if chunks else [text]


def _write_wav_bytes(samples: np.ndarray, sample_rate: int) -> bytes:
    if samples.ndim > 1:
        samples = np.squeeze(samples)
    samples = samples.astype(np.float32)

    with io.BytesIO() as b:
        sf.write(b, samples, sample_rate, format="WAV", subtype="PCM_16")
        return b.getvalue()


def _ensure_numpy(wav):
    # Handles torch tensors or numpy arrays
    if hasattr(wav, "detach"):
        wav = wav.detach().cpu().numpy()
    elif hasattr(wav, "cpu") and hasattr(wav, "numpy"):
        wav = wav.cpu().numpy()
    wav = np.asarray(wav)
    if wav.ndim > 1:
        wav = np.squeeze(wav)
    return wav.astype(np.float32)


def _load_model(model_name: str):
    global _model, _model_name

    model_name = (model_name or DEFAULT_MODEL).strip().lower()
    if model_name not in ("multilingual", "turbo"):
        model_name = DEFAULT_MODEL

    with _model_lock:
        if _model is not None and _model_name == model_name:
            return _model, _model_name

        print(f"Loading Chatterbox model='{model_name}' on device='{DEVICE}'...", file=sys.stderr)

        if model_name == "turbo":
            from chatterbox.tts_turbo import ChatterboxTurboTTS
            _model = ChatterboxTurboTTS.from_pretrained(device=DEVICE)
        else:
            from chatterbox.mtl_tts import ChatterboxMultilingualTTS
            _model = ChatterboxMultilingualTTS.from_pretrained(device=DEVICE)

        _model_name = model_name
        print(f"Model ready: {_model_name}", file=sys.stderr)
        return _model, _model_name


def _generate_chunk(chunk: str, model_name: str, language_id: str):
    model, loaded_model = _load_model(model_name)

    if loaded_model == "multilingual":
        wav = model.generate(chunk, language_id=language_id)
    else:
        # Turbo is primarily English and commonly used with reference audio.
        # For simple CPU smoke tests we generate without prompt.
        wav = model.generate(chunk)

    samples = _ensure_numpy(wav)
    sample_rate = int(getattr(model, "sr", 24000))
    return samples, sample_rate


def _do_generate(text: str, model_name: str, language_id: str) -> bytes:
    text = _preprocess_text(text)
    if not text:
        raise ValueError("No text provided")

    language_id = (language_id or DEFAULT_LANGUAGE_ID).strip().lower()
    model_name = (model_name or DEFAULT_MODEL).strip().lower()

    chunks = _split_chunks(text)
    print(f"Generating {len(chunks)} chunks with model={model_name}, lang={language_id}", file=sys.stderr)

    # Parallel chunking can be unstable for some model/runtime combos, keep it conservative.
    workers = min(MAX_PARALLEL_CHUNKS, len(chunks))
    results = [None] * len(chunks)

    def run_one(idx: int):
        cs = time.time()
        data = _generate_chunk(chunks[idx], model_name, language_id)
        dt = time.time() - cs
        print(f"  chunk {idx + 1}/{len(chunks)} in {dt:.2f}s", file=sys.stderr)
        return idx, data

    if workers <= 1:
        for i in range(len(chunks)):
            _, data = run_one(i)
            results[i] = data
    else:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(run_one, i) for i in range(len(chunks))]
            for fut in as_completed(futures):
                idx, data = fut.result()
                results[idx] = data

    sample_rate = results[0][1]
    combined = []
    for i, (samples, sr) in enumerate(results):
        if sr != sample_rate:
            raise RuntimeError(f"Sample-rate mismatch: expected {sample_rate}, got {sr}")
        combined.append(samples)
        if i < len(results) - 1:
            # 280ms pause between chunks
            silence = np.zeros(int(sample_rate * 0.28), dtype=np.float32)
            combined.append(silence)

    final_samples = np.concatenate(combined) if len(combined) > 1 else combined[0]
    return _write_wav_bytes(final_samples, sample_rate)


def _purge_old_jobs():
    now = time.time()
    with _jobs_lock:
        expired = [jid for jid, item in _jobs.items() if now - item.get("created", now) > JOB_TTL_SECONDS]
        for jid in expired:
            _jobs.pop(jid, None)
    if expired:
        print(f"Purged {len(expired)} expired jobs", file=sys.stderr)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model": _model_name or "not_loaded",
        "device": DEVICE,
    }), 200


@app.route("/", methods=["GET", "POST"])
def generate_sync():
    text = ""
    model = DEFAULT_MODEL
    language_id = DEFAULT_LANGUAGE_ID

    if request.method == "POST":
        if request.is_json:
            data = request.json or {}
            text = data.get("text", "")
            model = data.get("model", DEFAULT_MODEL)
            language_id = data.get("language_id", DEFAULT_LANGUAGE_ID)
        else:
            text = request.form.get("text", "")
            model = request.form.get("model", DEFAULT_MODEL)
            language_id = request.form.get("language_id", DEFAULT_LANGUAGE_ID)
    else:
        text = request.args.get("text", "")
        model = request.args.get("model", DEFAULT_MODEL)
        language_id = request.args.get("language_id", DEFAULT_LANGUAGE_ID)

    if not text:
        return "No text provided", 400

    try:
        audio = _do_generate(text, model, language_id)
        return send_file(
            io.BytesIO(audio),
            mimetype="audio/wav",
            as_attachment=False,
            download_name="tts.wav",
        )
    except Exception as e:
        print(f"Sync generation error: {e}", file=sys.stderr)
        return str(e), 500


@app.route("/generate/async", methods=["POST"])
def generate_async():
    if not request.is_json:
        return "JSON body required", 400

    data = request.json or {}
    text = data.get("text", "")
    if not text:
        return "No text provided", 400

    model = data.get("model", DEFAULT_MODEL)
    language_id = data.get("language_id", DEFAULT_LANGUAGE_ID)

    _purge_old_jobs()

    job_id = str(uuid.uuid4())
    with _jobs_lock:
        _jobs[job_id] = {
            "status": "processing",
            "result": None,
            "error": None,
            "created": time.time(),
        }

    def run_job():
        start = time.time()
        try:
            result = _do_generate(text, model, language_id)
            elapsed = time.time() - start
            print(f"Job {job_id} ready in {elapsed:.1f}s ({len(result)} bytes)", file=sys.stderr)
            with _jobs_lock:
                if job_id in _jobs:
                    _jobs[job_id]["status"] = "ready"
                    _jobs[job_id]["result"] = result
        except Exception as e:
            elapsed = time.time() - start
            print(f"Job {job_id} failed after {elapsed:.1f}s: {e}", file=sys.stderr)
            with _jobs_lock:
                if job_id in _jobs:
                    _jobs[job_id]["status"] = "error"
                    _jobs[job_id]["error"] = str(e)

    _job_executor.submit(run_job)
    return jsonify({"job_id": job_id}), 202


@app.route("/generate/status/<job_id>", methods=["GET"])
def generate_status(job_id):
    with _jobs_lock:
        job = _jobs.get(job_id)

    if job is None:
        return jsonify({"status": "not_found"}), 404

    return jsonify({"status": job["status"], "error": job.get("error")}), 200


@app.route("/generate/result/<job_id>", methods=["GET"])
def generate_result(job_id):
    with _jobs_lock:
        job = _jobs.get(job_id)

    if job is None:
        return jsonify({"error": "job not found"}), 404

    if job["status"] == "processing":
        return jsonify({"status": "processing"}), 202

    if job["status"] == "error":
        return jsonify({"error": job.get("error", "unknown error")}), 500

    result_bytes = job["result"]
    with _jobs_lock:
        _jobs.pop(job_id, None)

    return send_file(
        io.BytesIO(result_bytes),
        mimetype="audio/wav",
        as_attachment=False,
        download_name="tts.wav",
    )


@app.route("/batch", methods=["POST"])
def generate_batch():
    if not request.is_json:
        return "JSON body required", 400

    data = request.json or {}
    items = data.get("items", [])
    model = data.get("model", DEFAULT_MODEL)
    language_id = data.get("language_id", DEFAULT_LANGUAGE_ID)

    if not items:
        return jsonify({"results": []}), 200

    results = []
    for item in items:
        item_id = item.get("id", "unknown")
        text = item.get("text", "")
        if not text:
            results.append({"id": item_id, "audio": None, "error": "No text"})
            continue

        try:
            audio = _do_generate(text, model, language_id)
            audio_b64 = base64.b64encode(audio).decode("ascii")
            results.append({"id": item_id, "audio": f"data:audio/wav;base64,{audio_b64}", "error": None})
        except Exception as e:
            print(f"Batch item {item_id} failed: {e}", file=sys.stderr)
            results.append({"id": item_id, "audio": None, "error": str(e)})

    return jsonify({"results": results}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    print(f"Starting Chatterbox TTS server on port {port}", file=sys.stderr)
    app.run(host="0.0.0.0", port=port)
