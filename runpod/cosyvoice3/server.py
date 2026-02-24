import argparse
import asyncio
import io
import os
import re
import threading
import tempfile
from pathlib import Path
from typing import Any, Callable, Optional, Tuple

import requests
import torch
import torchaudio
import uvicorn
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from huggingface_hub import snapshot_download
from pydub import AudioSegment


def env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
        return value if value > 0 else default
    except ValueError:
        return default


def env_float(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
        return value if value > 0 else default
    except ValueError:
        return default


MODEL_ID = os.getenv("COSYVOICE_MODEL_ID", "FunAudioLLM/Fun-CosyVoice3-0.5B-2512").strip()
MODEL_DIR = os.getenv("COSYVOICE_MODEL_DIR", "/opt/models/Fun-CosyVoice3-0.5B-2512").strip()
API_KEY = os.getenv("COSYVOICE_API_KEY", "").strip()
DEFAULT_PROMPT_TEXT = os.getenv("COSYVOICE_DEFAULT_PROMPT_TEXT", "").strip()
DEFAULT_REF_WAV = os.getenv("COSYVOICE_DEFAULT_REF_WAV", "").strip()
DEFAULT_REF_WAV_URL = os.getenv("COSYVOICE_DEFAULT_REF_WAV_URL", "").strip()
DEFAULT_SPK_ID = os.getenv("COSYVOICE_DEFAULT_SPK_ID", "").strip()
DEFAULT_SYSTEM_PROMPT = os.getenv("COSYVOICE_SYSTEM_PROMPT", "You are a helpful assistant.").strip()
INFERENCE_TIMEOUT_SEC = env_int("COSYVOICE_INFERENCE_TIMEOUT_SEC", 1200)
MAX_CONCURRENT = env_int("COSYVOICE_MAX_CONCURRENT", 1)
DEFAULT_SPEED = env_float("COSYVOICE_DEFAULT_SPEED", 1.0)

EMOTION_TO_INSTRUCT = {
    "neutral": "Please speak in a calm, clear, child-friendly neutral tone.",
    "happy": "Please speak in a warm, joyful, playful tone suitable for children.",
    "sad": "Please speak in a soft, gentle, slightly sad but safe tone.",
    "excited": "Please speak with energetic excitement while staying clear and pleasant.",
    "calm": "Please speak in a very calm, slow, reassuring tone.",
    "serious": "Please speak in a focused, informative, serious educational tone.",
}

# Lazy runtime state
resolved_model_dir = MODEL_DIR
default_reference_path = ""
cosyvoice_model: Optional[Any] = None
runtime_lock = threading.Lock()
runtime_init_started = False
runtime_init_error = ""

# Cached default reference WAV path (as .wav file, converted from mp3 if needed)
_default_ref_wav_path: Optional[str] = None
_default_ref_wav_lock = threading.Lock()


def ensure_model_dir() -> str:
    path = Path(MODEL_DIR)
    if path.exists() and any(path.iterdir()):
        print(f"[startup] Using existing model dir: {path}")
        return str(path)

    print(f"[startup] Downloading model {MODEL_ID} into {path} ...")
    path.mkdir(parents=True, exist_ok=True)
    snapshot_download(
        repo_id=MODEL_ID,
        local_dir=str(path),
        local_dir_use_symlinks=False,
        resume_download=True,
    )
    print("[startup] Model download finished.")
    return str(path)


def ensure_default_reference() -> str:
    """Return a local WAV file path for the default reference audio.
    Converts mp3 to wav if needed. CosyVoice needs a file path, not a tensor.
    """
    global _default_ref_wav_path

    with _default_ref_wav_lock:
        if _default_ref_wav_path and Path(_default_ref_wav_path).exists():
            return _default_ref_wav_path

        ref_src = DEFAULT_REF_WAV

        # Download from URL if configured and file not present
        if not ref_src or not Path(ref_src).exists():
            if DEFAULT_REF_WAV_URL:
                target_dir = Path("/opt/default-voices")
                target_dir.mkdir(parents=True, exist_ok=True)
                downloaded = target_dir / "narrator_sample_dl"
                ext = Path(DEFAULT_REF_WAV_URL).suffix.lower() or ".bin"
                downloaded = downloaded.with_suffix(ext)
                if not downloaded.exists():
                    print(f"[startup] Downloading default reference audio from {DEFAULT_REF_WAV_URL} ...")
                    response = requests.get(DEFAULT_REF_WAV_URL, timeout=30)
                    response.raise_for_status()
                    downloaded.write_bytes(response.content)
                    print(f"[startup] Downloaded reference audio saved to {downloaded}")
                ref_src = str(downloaded)
            else:
                print("[startup] No default reference audio configured.")
                return ""

        if not Path(ref_src).exists():
            print(f"[startup] Default reference audio not found: {ref_src}")
            return ""

        # Always normalize to a real mono 16k WAV to avoid format edge cases.
        wav_path = str(Path("/opt/default-voices/narrator_sample_norm.wav"))
        if not Path(wav_path).exists():
            print(f"[startup] Normalizing default reference to WAV: {ref_src} -> {wav_path}")
            audio = AudioSegment.from_file(ref_src)
            audio = audio.set_frame_rate(16000).set_channels(1)
            audio.export(wav_path, format="wav")
            print(f"[startup] Default reference normalization done: {wav_path}")
        _default_ref_wav_path = wav_path

        print(f"[startup] Default reference audio ready: {_default_ref_wav_path}")
        return _default_ref_wav_path


def init_runtime_sync() -> None:
    global resolved_model_dir, default_reference_path, cosyvoice_model, runtime_init_error
    if cosyvoice_model is not None:
        return

    with runtime_lock:
        if cosyvoice_model is not None:
            return

        resolved_model_dir = ensure_model_dir()
        default_reference_path = ensure_default_reference()
        from cosyvoice.cli.cosyvoice import AutoModel

        print(f"[startup] Loading CosyVoice runtime from model dir: {resolved_model_dir}")
        cosyvoice_model = AutoModel(model_dir=resolved_model_dir)
        available = list_available_speakers(cosyvoice_model)
        print(f"[startup] CosyVoice model loaded. Available speakers ({len(available)}): {available[:20]}")
        if default_reference_path:
            print(f"[startup] Default reference audio: {default_reference_path}")
        runtime_init_error = ""


async def ensure_runtime_initialized() -> None:
    await asyncio.to_thread(init_runtime_sync)


def _runtime_init_worker() -> None:
    global runtime_init_error
    try:
        init_runtime_sync()
    except Exception as exc:
        runtime_init_error = str(exc)
        print(f"[startup] Runtime init failed: {exc}")


def kickoff_runtime_init_background() -> None:
    global runtime_init_started
    with runtime_lock:
        if runtime_init_started:
            return
        runtime_init_started = True
    thread = threading.Thread(target=_runtime_init_worker, daemon=True, name="cosyvoice-init")
    thread.start()


def validate_api_key(authorization: Optional[str], x_api_key: Optional[str]) -> None:
    if not API_KEY:
        return

    token = ""
    if authorization:
        value = authorization.strip()
        if value.lower().startswith("bearer "):
            token = value.split(" ", 1)[1].strip()

    if not token and x_api_key:
        token = x_api_key.strip()

    if token != API_KEY:
        print(
            "[auth] Unauthorized request "
            f"(api_key_configured={bool(API_KEY)} bearer_present={bool(authorization)} x_api_key_present={bool(x_api_key)})"
        )
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")


def normalize_cv3_prompt_text(prompt_text: str) -> str:
    cleaned_prompt = (prompt_text or "").strip()
    if not cleaned_prompt:
        return ""
    if "<|endofprompt|>" in cleaned_prompt:
        return cleaned_prompt

    system_prompt = (DEFAULT_SYSTEM_PROMPT or "You are a helpful assistant.").strip()
    return f"{system_prompt}<|endofprompt|>{cleaned_prompt}"


def normalize_cv3_instruction(instruct_text: str) -> str:
    cleaned = (instruct_text or "").strip()
    if not cleaned:
        return ""
    if "<|endofprompt|>" in cleaned:
        return cleaned
    return f"{cleaned}<|endofprompt|>"


def resolve_instruct_text(instruct_text: str, emotion: str) -> str:
    direct = (instruct_text or "").strip()
    if direct:
        return normalize_cv3_instruction(direct)

    normalized = (emotion or "").strip().lower()
    if not normalized:
        return ""

    selected = EMOTION_TO_INSTRUCT.get(normalized, normalized)
    return normalize_cv3_instruction(selected)


def list_available_speakers(cosyvoice: Any) -> list[str]:
    try:
        speakers = cosyvoice.list_available_spks()
    except Exception as exc:
        print(f"[runtime] list_available_spks failed: {exc}")
        return []

    if not isinstance(speakers, list):
        return []

    normalized: list[str] = []
    for speaker in speakers:
        value = str(speaker).strip()
        if value:
            normalized.append(value)
    return normalized


def resolve_sft_speaker_id(cosyvoice: Any, requested_speaker: str) -> str:
    available = list_available_speakers(cosyvoice)
    requested = (requested_speaker or DEFAULT_SPK_ID).strip()

    if requested:
        if available and requested not in available:
            preview = ", ".join(available[:20])
            raise HTTPException(
                status_code=400,
                detail=f"speaker '{requested}' not available. Available: {preview}",
            )
        return requested

    if available:
        return available[0]

    # CosyVoice3 0.5B has no built-in SFT speakers - this is expected.
    return ""


async def save_upload_to_temp_wav(reference_audio: UploadFile) -> str:
    """Save an uploaded audio file to a temp WAV file and return the path.
    CosyVoice needs a file path string, not a tensor.
    """
    payload = await reference_audio.read()
    if not payload:
        raise HTTPException(status_code=400, detail="reference_audio is empty.")

    suffix = Path(reference_audio.filename or "reference.wav").suffix.lower() or ".bin"

    # Write original file
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(payload)
        tmp_path = tmp.name

    # Always normalize upload to WAV (mono 16k) and return that path.
    wav_path = f"{tmp_path}.wav"
    try:
        audio = AudioSegment.from_file(tmp_path)
        audio = audio.set_frame_rate(16000).set_channels(1)
        audio.export(wav_path, format="wav")
        os.unlink(tmp_path)
        return wav_path
    except Exception as exc:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        if os.path.exists(wav_path):
            os.unlink(wav_path)
        raise HTTPException(status_code=400, detail=f"Failed to normalize reference audio: {exc}")


def collect_waveform(generator) -> torch.Tensor:
    chunks = []
    for item in generator:
        speech = item.get("tts_speech") if isinstance(item, dict) else None
        if speech is None:
            continue
        if speech.dim() == 1:
            speech = speech.unsqueeze(0)
        chunks.append(speech.detach().cpu())

    if not chunks:
        raise RuntimeError("CosyVoice returned no audio chunks.")

    return torch.cat(chunks, dim=1)


def waveform_to_wav_bytes(waveform: torch.Tensor, sample_rate: int) -> bytes:
    wav_buffer = io.BytesIO()
    torchaudio.save(wav_buffer, waveform, sample_rate, format="wav")
    return wav_buffer.getvalue()


def wav_to_mp3_bytes(wav_bytes: bytes) -> bytes:
    audio_segment = AudioSegment.from_file(io.BytesIO(wav_bytes), format="wav")
    mp3_buffer = io.BytesIO()
    audio_segment.export(mp3_buffer, format="mp3", bitrate="128k")
    return mp3_buffer.getvalue()


def trim_error_message(message: str, max_len: int = 220) -> str:
    cleaned = (message or "").replace("\n", " ").replace("\r", " ").strip()
    if len(cleaned) <= max_len:
        return cleaned
    return f"{cleaned[:max_len]}..."


def load_reference_audio_tensor(reference_wav_path: str, target_sr: int = 16000) -> torch.Tensor:
    waveform, source_sr = torchaudio.load(reference_wav_path)
    if waveform.dim() == 1:
        waveform = waveform.unsqueeze(0)
    if waveform.size(0) > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    if source_sr != target_sr:
        waveform = torchaudio.functional.resample(waveform, source_sr, target_sr)
    return waveform


def infer_waveform_with_reference_variants(
    mode_label: str,
    build_generator: Callable[[Any], Any],
    reference_wav_path: str,
) -> torch.Tensor:
    """Run inference with reference as path first, then tensor fallback."""
    path_error: Optional[str] = None

    try:
        generator = build_generator(reference_wav_path)
        return collect_waveform(generator)
    except Exception as exc:
        path_error = trim_error_message(str(exc))
        print(f"[tts] {mode_label} path-ref failed: {path_error}")

    try:
        reference_tensor = load_reference_audio_tensor(reference_wav_path, target_sr=16000)
        generator = build_generator(reference_tensor)
        return collect_waveform(generator)
    except Exception as exc:
        tensor_error = trim_error_message(str(exc))
        print(f"[tts] {mode_label} tensor-ref failed: {tensor_error}")
        raise RuntimeError(
            f"{mode_label} failed for both reference variants "
            f"(path='{reference_wav_path}', path_err='{path_error}', tensor_err='{tensor_error}')"
        ) from exc


def generate_audio(
    cosyvoice: Any,
    text: str,
    prompt_text: str,
    instruct_text: str,
    emotion: str,
    output_format: str,
    reference_wav_path: Optional[str],  # FILE PATH, not tensor!
    speed: float,
    speaker: str,
    ref_default_path: str,
) -> Tuple[bytes, str, str, Optional[str]]:
    """Generate audio. reference_wav_path and ref_default_path are file path STRINGS.
    CosyVoice handles loading internally via torchaudio.load().
    """
    # Important:
    # - For uploaded/custom reference audio we should NOT force DEFAULT_PROMPT_TEXT,
    #   because zero-shot requires the exact transcript of that specific reference clip.
    #   A mismatched transcript often produces garbled output.
    # - For built-in default reference we can safely use DEFAULT_PROMPT_TEXT fallback.
    requested_prompt_text = (prompt_text or "").strip()
    had_custom_reference = reference_wav_path is not None
    final_prompt_text = ""
    if requested_prompt_text:
        final_prompt_text = normalize_cv3_prompt_text(requested_prompt_text)
    elif not had_custom_reference:
        final_prompt_text = normalize_cv3_prompt_text(DEFAULT_PROMPT_TEXT or "")
    final_instruct_text = resolve_instruct_text(instruct_text, emotion)
    used_speaker: Optional[str] = None

    # CosyVoice3 0.5B has NO built-in SFT speakers - all modes need reference audio.
    if reference_wav_path is None:
        # Check if model has SFT speakers (not the case for CosyVoice3 0.5B)
        sft_id = resolve_sft_speaker_id(cosyvoice, speaker)
        if sft_id:
            used_speaker = sft_id
            print(f"[tts] Mode: sft, speaker={sft_id}")
            generator = cosyvoice.inference_sft(text, sft_id, stream=False, speed=speed)
            waveform = collect_waveform(generator)
            wav_bytes = waveform_to_wav_bytes(waveform, cosyvoice.sample_rate)
            normalized_format = output_format.strip().lower()
            if normalized_format == "mp3":
                return wav_to_mp3_bytes(wav_bytes), "audio/mpeg", "mp3", used_speaker
            return wav_bytes, "audio/wav", "wav", used_speaker

        # Fall back to default reference audio
        if not ref_default_path or not Path(ref_default_path).exists():
            raise HTTPException(
                status_code=400,
                detail=(
                    "No reference audio provided and no default voice configured. "
                    "Set COSYVOICE_DEFAULT_REF_WAV or upload reference_audio."
                ),
            )
        reference_wav_path = ref_default_path
        print(f"[tts] Using default reference audio: {reference_wav_path}")

    # CosyVoice expects a file path string, it loads the audio internally.
    # Choose inference mode based on available parameters.
    if final_instruct_text:
        print(f"[tts] Mode: instruct2, instruct={final_instruct_text[:60]}")
        waveform = infer_waveform_with_reference_variants(
            "instruct2",
            lambda ref: cosyvoice.inference_instruct2(
                text, final_instruct_text, ref, stream=False, speed=speed,
            ),
            reference_wav_path,
        )
    elif final_prompt_text:
        print(f"[tts] Mode: zero_shot, prompt_text_len={len(final_prompt_text)}")
        try:
            waveform = infer_waveform_with_reference_variants(
                "zero_shot",
                lambda ref: cosyvoice.inference_zero_shot(
                    text, final_prompt_text, ref, stream=False, speed=speed,
                ),
                reference_wav_path,
            )
        except Exception as exc:
            # Defensive fallback: if zero-shot is incompatible in a specific CosyVoice build,
            # fall back to cross-lingual so requests still return playable audio.
            fallback_reason = trim_error_message(str(exc))
            print(f"[tts] zero_shot fallback -> cross_lingual. reason={fallback_reason}")
            waveform = infer_waveform_with_reference_variants(
                "cross_lingual_fallback",
                lambda ref: cosyvoice.inference_cross_lingual(
                    text, ref, stream=False, speed=speed,
                ),
                reference_wav_path,
            )
    else:
        # cross_lingual: clones voice without needing a transcript of the reference
        print(f"[tts] Mode: cross_lingual")
        waveform = infer_waveform_with_reference_variants(
            "cross_lingual",
            lambda ref: cosyvoice.inference_cross_lingual(
                text, ref, stream=False, speed=speed,
            ),
            reference_wav_path,
        )
    wav_bytes = waveform_to_wav_bytes(waveform, cosyvoice.sample_rate)

    normalized_format = output_format.strip().lower()
    if normalized_format == "mp3":
        return wav_to_mp3_bytes(wav_bytes), "audio/mpeg", "mp3", used_speaker

    return wav_bytes, "audio/wav", "wav", used_speaker


app = FastAPI(title="CosyVoice 3 RunPod API", version="1.0.0")
semaphore = asyncio.Semaphore(MAX_CONCURRENT)


@app.on_event("startup")
async def on_startup() -> None:
    kickoff_runtime_init_background()


@app.get("/ping")
def ping() -> JSONResponse:
    # RunPod Load Balancer health endpoint.
    # Keep this always 200 to avoid aggressive worker restart loops during warmup.
    if runtime_init_error:
        return JSONResponse({"status": "error", "detail": runtime_init_error}, status_code=200)
    if cosyvoice_model is None:
        kickoff_runtime_init_background()
        return JSONResponse({"status": "initializing"}, status_code=200)
    return JSONResponse({"status": "healthy"})


@app.get("/")
def root() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.get("/health")
def health() -> JSONResponse:
    available_speakers: list[str] = []
    if cosyvoice_model is not None:
        available_speakers = list_available_speakers(cosyvoice_model)[:20]

    return JSONResponse(
        {
            "ok": True,
            "init_started": runtime_init_started,
            "init_error": runtime_init_error,
            "model_id": MODEL_ID,
            "model_dir": resolved_model_dir,
            "model_loaded": bool(cosyvoice_model is not None),
            "gpu_available": bool(torch.cuda.is_available()),
            "default_prompt_text_set": bool(DEFAULT_PROMPT_TEXT),
            "default_reference_available": bool(default_reference_path and Path(default_reference_path).exists()),
            "default_reference_path": default_reference_path,
            "default_speaker": DEFAULT_SPK_ID,
            "available_speakers": available_speakers,
            "max_concurrent": MAX_CONCURRENT,
        }
    )


@app.post("/v1/tts")
async def tts(
    text: str = Form(...),
    prompt_text: str = Form(""),
    instruct_text: str = Form(""),
    emotion: str = Form(""),
    output_format: str = Form("wav"),
    speed: float = Form(DEFAULT_SPEED),
    speaker: str = Form(""),
    reference_audio: Optional[UploadFile] = File(default=None),
    authorization: Optional[str] = Header(default=None),
    x_api_key: Optional[str] = Header(default=None),
):
    validate_api_key(authorization, x_api_key)

    cleaned_text = (text or "").strip()
    if not cleaned_text:
        raise HTTPException(status_code=400, detail="text is required.")

    normalized_format = output_format.strip().lower()
    if normalized_format not in {"wav", "mp3"}:
        raise HTTPException(status_code=400, detail="output_format must be wav or mp3.")

    if speed <= 0 or speed > 3.0:
        raise HTTPException(status_code=400, detail="speed must be in range (0, 3].")

    await ensure_runtime_initialized()
    if runtime_init_error:
        raise HTTPException(status_code=500, detail=f"CosyVoice runtime init failed: {runtime_init_error}")
    model = cosyvoice_model
    if model is None:
        raise HTTPException(status_code=503, detail="CosyVoice model is not initialized.")

    # Save uploaded reference audio to a temp WAV file path (CosyVoice needs file paths)
    ref_wav_path: Optional[str] = None
    temp_file_to_cleanup: Optional[str] = None

    if reference_audio is not None:
        ref_wav_path = await save_upload_to_temp_wav(reference_audio)
        temp_file_to_cleanup = ref_wav_path

    try:
        async with semaphore:
            try:
                audio_bytes, mime_type, used_format, used_speaker = await asyncio.wait_for(
                    asyncio.to_thread(
                        generate_audio,
                        model,
                        cleaned_text,
                        prompt_text,
                        instruct_text,
                        emotion,
                        normalized_format,
                        ref_wav_path,       # file path or None
                        speed,
                        speaker,
                        default_reference_path,  # fallback file path
                    ),
                    timeout=INFERENCE_TIMEOUT_SEC,
                )
            except asyncio.TimeoutError as exc:
                raise HTTPException(
                    status_code=504,
                    detail=f"Generation timed out after {INFERENCE_TIMEOUT_SEC}s.",
                ) from exc
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(status_code=500, detail=f"CosyVoice generation failed: {exc}") from exc
    finally:
        if temp_file_to_cleanup and os.path.exists(temp_file_to_cleanup):
            try:
                os.unlink(temp_file_to_cleanup)
            except OSError:
                pass

    headers = {
        "X-Audio-Format": used_format,
        "X-CosyVoice-Model": MODEL_ID,
    }
    if used_speaker:
        headers["X-CosyVoice-Speaker"] = used_speaker
    return StreamingResponse(io.BytesIO(audio_bytes), media_type=mime_type, headers=headers)


def parse_port(value: str, fallback: int) -> int:
    raw = (value or "").strip()
    if not raw:
        return fallback
    if raw.isdigit():
        parsed = int(raw)
        return parsed if parsed > 0 else fallback

    match = re.search(r"\d+", raw)
    if not match:
        return fallback

    parsed = int(match.group(0))
    return parsed if parsed > 0 else fallback


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CosyVoice 3 FastAPI server")
    parser.add_argument("--host", type=str, default=os.getenv("COSYVOICE_HOST", "0.0.0.0"))
    parser.add_argument("--port", type=str, default=os.getenv("PORT", os.getenv("COSYVOICE_PORT", "80")))

    args, unknown = parser.parse_known_args()
    if unknown:
        print(f"[start] Ignoring unknown args: {unknown}")

    fallback_port = env_int("PORT", env_int("COSYVOICE_PORT", 80))
    args.port = parse_port(args.port, fallback_port)
    return args


if __name__ == "__main__":
    args = parse_args()
    print(f"[start] FastAPI bootstrap on {args.host}:{args.port} (model lazy-load enabled)")
    uvicorn.run(app, host=args.host, port=args.port, workers=1)
