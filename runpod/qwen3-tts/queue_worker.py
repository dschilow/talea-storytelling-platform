import base64
import os
import traceback
from typing import Any, Dict, Optional
import tempfile

import runpod
import server as qwen_server

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

    return qwen_server.save_audio_bytes_to_temp_wav(payload, filename)

def _cleanup_temp_file(path: Optional[str]) -> None:
    if path and os.path.exists(path):
        try:
            os.unlink(path)
        except OSError:
            pass

def _extract_shared_params(job_input: Dict[str, Any]) -> Dict[str, Any]:
    """Extract shared TTS parameters from job input."""
    return {
        "prompt_text": str(job_input.get("prompt_text") or "").strip(),
        "output_format": _normalize_output_format(str(job_input.get("output_format") or "wav")),
        "speed": float(job_input.get("speed", 1.0)),
    }

def _generate_single(
    text: str,
    params: Dict[str, Any],
    ref_wav_path: Optional[str],
) -> Dict[str, Any]:
    """Generate audio for a single text. Returns dict with audioBase64 or error."""
    try:
        audio_bytes, mime_type, used_format = qwen_server.generate_audio(
            model=qwen_server.qwen_model,
            text=text,
            prompt_text=params["prompt_text"],
            output_format=params["output_format"],
            reference_audio_path=ref_wav_path,
            speed=params["speed"],
        )
        return {
            "audioBase64": base64.b64encode(audio_bytes).decode("ascii"),
            "mimeType": mime_type,
            "format": used_format,
        }
    except Exception as e:
        return {
            "error": str(e),
            "traceback": traceback.format_exc(),
        }

def _handle_tts(job_input: Dict[str, Any]) -> Dict[str, Any]:
    text = job_input.get("tts_text") or job_input.get("text")
    if not text:
        return {"error": "Missing 'tts_text' or 'text' in input"}

    params = _extract_shared_params(job_input)
    ref_wav_path = None

    try:
        ref_wav_path = _decode_reference_to_temp_wav(job_input)
        return _generate_single(text, params, ref_wav_path)
    finally:
        _cleanup_temp_file(ref_wav_path)

def handler(job: Dict[str, Any]) -> Dict[str, Any]:
    """
    RunPod entry point.
    Expects job["input"] with:
    - text / tts_text (str): The text to synthesize.
    - reference_audio_base64 (str): Base64 encoded reference audio for Voice Cloning.
    - prompt_text (str): Transcript of the reference audio (if needed).
    - speed (float, optional)
    """
    job_input = job.get("input", {})
    
    # Simple Health Check route
    is_health_check = job_input.get("health_check") is True
    if is_health_check:
        return {"health_status": "OK", "model_loaded": qwen_server.qwen_model is not None}

    try:
        return _handle_tts(job_input)
    except Exception as exc:
        return {
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }

if __name__ == "__main__":
    print("Starting Qwen3-TTS RunPod Worker...")
    runpod.serverless.start({"handler": handler})
