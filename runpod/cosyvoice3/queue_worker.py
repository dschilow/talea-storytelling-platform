import base64
import os
from typing import Any, Dict, Optional

import runpod

import server as cosy_server


def _normalize_output_format(value: str) -> str:
    normalized = (value or "").strip().lower()
    return "mp3" if normalized == "mp3" else "wav"


def _decode_reference_to_temp_wav(job_input: Dict[str, Any]) -> Optional[str]:
    ref_b64 = str(job_input.get("reference_audio_base64") or "").strip()
    if not ref_b64:
        return None

    filename = str(job_input.get("reference_audio_filename") or "reference.wav").strip() or "reference.wav"
    try:
        payload = base64.b64decode(ref_b64, validate=True)
    except Exception as exc:
        raise ValueError(f"Invalid reference_audio_base64: {exc}") from exc

    if not payload:
        raise ValueError("reference_audio_base64 is empty.")

    return cosy_server.save_audio_bytes_to_temp_wav(payload, filename)


def _health_payload() -> Dict[str, Any]:
    model_loaded = cosy_server.cosyvoice_model is not None
    available_speakers = []
    if model_loaded:
        available_speakers = cosy_server.list_available_speakers(cosy_server.cosyvoice_model)[:50]

    return {
        "ok": True,
        "modelLoaded": model_loaded,
        "modelId": cosy_server.MODEL_ID,
        "defaultReferenceAvailable": bool(
            cosy_server.default_reference_path and os.path.exists(cosy_server.default_reference_path)
        ),
        "defaultReferencePath": cosy_server.default_reference_path,
        "availableSpeakers": available_speakers,
    }


def handler(job: Dict[str, Any]) -> Dict[str, Any]:
    job_input = job.get("input") or {}
    if not isinstance(job_input, dict):
        raise ValueError("Job input must be an object.")

    action = str(job_input.get("action") or "tts").strip().lower()

    cosy_server.init_runtime_sync()
    if cosy_server.runtime_init_error:
        raise RuntimeError(f"CosyVoice runtime init failed: {cosy_server.runtime_init_error}")
    if cosy_server.cosyvoice_model is None:
        raise RuntimeError("CosyVoice model is not initialized.")

    if action in {"health", "voices"}:
        return _health_payload()
    if action != "tts":
        raise ValueError(f"Unsupported action: {action}")

    text = str(job_input.get("text") or "").strip()
    if not text:
        raise ValueError("text is required.")

    prompt_text = str(job_input.get("prompt_text") or "").strip()
    instruct_text = str(job_input.get("instruct_text") or "").strip()
    emotion = str(job_input.get("emotion") or "").strip()
    output_format = _normalize_output_format(str(job_input.get("output_format") or "wav"))
    speaker = str(job_input.get("speaker") or "").strip()

    speed_raw = job_input.get("speed", cosy_server.DEFAULT_SPEED)
    try:
        speed = float(speed_raw)
    except (TypeError, ValueError):
        speed = cosy_server.DEFAULT_SPEED
    if speed <= 0 or speed > 3.0:
        raise ValueError("speed must be in range (0, 3].")

    ref_wav_path: Optional[str] = None
    try:
        ref_wav_path = _decode_reference_to_temp_wav(job_input)

        audio_bytes, mime_type, used_format, used_speaker = cosy_server.generate_audio(
            cosy_server.cosyvoice_model,
            text,
            prompt_text,
            instruct_text,
            emotion,
            output_format,
            ref_wav_path,
            speed,
            speaker,
            cosy_server.default_reference_path,
        )

        return {
            "audioBase64": base64.b64encode(audio_bytes).decode("ascii"),
            "mimeType": mime_type,
            "outputFormat": used_format,
            "speaker": used_speaker or "",
        }
    finally:
        if ref_wav_path and os.path.exists(ref_wav_path):
            try:
                os.unlink(ref_wav_path)
            except OSError:
                pass


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
