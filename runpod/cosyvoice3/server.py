import argparse
import asyncio
import io
import os
import tempfile
from pathlib import Path
from typing import Any, Optional, Tuple

import requests
import torch
import torchaudio
import uvicorn
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from huggingface_hub import snapshot_download
from pydub import AudioSegment

from cosyvoice.cli.cosyvoice import AutoModel
from cosyvoice.utils.file_utils import load_wav


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
    if DEFAULT_REF_WAV and Path(DEFAULT_REF_WAV).exists():
        return DEFAULT_REF_WAV

    if not DEFAULT_REF_WAV_URL:
        return ""

    target_dir = Path("/opt/default-voices")
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / "narrator_sample.wav"

    if target_path.exists():
        return str(target_path)

    print(f"[startup] Downloading default reference audio from {DEFAULT_REF_WAV_URL} ...")
    response = requests.get(DEFAULT_REF_WAV_URL, timeout=30)
    response.raise_for_status()
    target_path.write_bytes(response.content)
    print(f"[startup] Default reference audio saved to {target_path}")
    return str(target_path)


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


async def load_reference_audio(reference_audio: Optional[UploadFile], default_ref_path: str) -> Optional[torch.Tensor]:
    if reference_audio is not None:
        payload = await reference_audio.read()
        if not payload:
            raise HTTPException(status_code=400, detail="reference_audio is empty.")

        suffix = Path(reference_audio.filename or "reference.wav").suffix or ".wav"
        temp_path = ""

        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                temp_file.write(payload)
                temp_path = temp_file.name
            return load_wav(temp_path, 16000)
        finally:
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)

    if default_ref_path and Path(default_ref_path).exists():
        return load_wav(default_ref_path, 16000)

    return None


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


def generate_audio(
    cosyvoice: Any,
    text: str,
    prompt_text: str,
    instruct_text: str,
    emotion: str,
    output_format: str,
    reference_wav: Optional[torch.Tensor],
    speed: float,
) -> Tuple[bytes, str, str]:
    final_prompt_text = normalize_cv3_prompt_text(prompt_text or DEFAULT_PROMPT_TEXT or "")
    final_instruct_text = resolve_instruct_text(instruct_text, emotion)

    if reference_wav is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "No reference audio available. Provide reference_audio or configure "
                "COSYVOICE_DEFAULT_REF_WAV / COSYVOICE_DEFAULT_REF_WAV_URL."
            ),
        )

    if final_instruct_text:
        generator = cosyvoice.inference_instruct2(
            text,
            final_instruct_text,
            reference_wav,
            stream=False,
            speed=speed,
        )
    else:
        if not final_prompt_text:
            raise HTTPException(
                status_code=400,
                detail=(
                    "prompt_text is required for zero-shot cloning. "
                    "Provide prompt_text or configure COSYVOICE_DEFAULT_PROMPT_TEXT."
                ),
            )

        generator = cosyvoice.inference_zero_shot(
            text,
            final_prompt_text,
            reference_wav,
            stream=False,
            speed=speed,
        )

    waveform = collect_waveform(generator)
    wav_bytes = waveform_to_wav_bytes(waveform, cosyvoice.sample_rate)

    normalized_format = output_format.strip().lower()
    if normalized_format == "mp3":
        return wav_to_mp3_bytes(wav_bytes), "audio/mpeg", "mp3"

    return wav_bytes, "audio/wav", "wav"


# Startup
resolved_model_dir = ensure_model_dir()
default_reference_path = ensure_default_reference()
print(f"[startup] Loading CosyVoice runtime from model dir: {resolved_model_dir}")
cosyvoice_model = AutoModel(model_dir=resolved_model_dir)
print("[startup] CosyVoice model loaded.")

app = FastAPI(title="CosyVoice 3 RunPod API", version="1.0.0")
semaphore = asyncio.Semaphore(MAX_CONCURRENT)


@app.get("/ping")
def ping() -> JSONResponse:
    # Required health endpoint for RunPod Load Balancer workers.
    return JSONResponse({"status": "healthy"})


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse(
        {
            "ok": True,
            "model_id": MODEL_ID,
            "model_dir": resolved_model_dir,
            "gpu_available": bool(torch.cuda.is_available()),
            "default_prompt_text_set": bool(DEFAULT_PROMPT_TEXT),
            "default_reference_available": bool(default_reference_path and Path(default_reference_path).exists()),
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

    reference_wav = await load_reference_audio(reference_audio, default_reference_path)

    async with semaphore:
        try:
            audio_bytes, mime_type, used_format = await asyncio.wait_for(
                asyncio.to_thread(
                    generate_audio,
                    cosyvoice_model,
                    cleaned_text,
                    prompt_text,
                    instruct_text,
                    emotion,
                    normalized_format,
                    reference_wav,
                    speed,
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

    headers = {
        "X-Audio-Format": used_format,
        "X-CosyVoice-Model": MODEL_ID,
    }
    return StreamingResponse(io.BytesIO(audio_bytes), media_type=mime_type, headers=headers)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CosyVoice 3 FastAPI server")
    parser.add_argument("--host", type=str, default=os.getenv("COSYVOICE_HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=env_int("PORT", env_int("COSYVOICE_PORT", 80)))
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    uvicorn.run(app, host=args.host, port=args.port, workers=1)
