import base64
import os
import traceback
from typing import Any, Dict, List, Optional

import runpod
import server as qwen_server

MAX_BATCH_ITEMS = 50


def _normalize_output_format(value: str) -> str:
    normalized = (value or "").strip().lower()
    return "mp3" if normalized == "mp3" else "wav"


def _parse_speed(raw: Any) -> float:
    try:
        speed = float(raw)
    except (TypeError, ValueError):
        return 1.0
    if speed <= 0 or speed > 3.0:
        return 1.0
    return speed


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


def _safe_supported_speakers() -> List[str]:
    model = qwen_server.qwen_model
    if model is None:
        return []
    try:
        speakers = model.get_supported_speakers()
    except Exception:
        return []
    if not isinstance(speakers, (list, tuple)):
        return []
    return [str(s).strip() for s in speakers if str(s).strip()]


def _safe_supported_languages() -> List[str]:
    model = qwen_server.qwen_model
    if model is None:
        return []
    try:
        languages = model.get_supported_languages()
    except Exception:
        return []
    if not isinstance(languages, (list, tuple)):
        return []
    return [str(l).strip() for l in languages if str(l).strip()]


def _health_payload() -> Dict[str, Any]:
    model_loaded = qwen_server.qwen_model is not None
    return {
        "ok": True,
        "modelLoaded": model_loaded,
        "modelId": getattr(qwen_server, "MODEL_ID", ""),
        "defaultReferenceAvailable": False,
        "defaultReferencePath": "",
        "availableSpeakers": _safe_supported_speakers()[:100],
        "availableLanguages": _safe_supported_languages()[:40],
    }


def _extract_shared_params(job_input: Dict[str, Any]) -> Dict[str, Any]:
    """Extract shared TTS parameters from job input."""
    return {
        "prompt_text": str(job_input.get("prompt_text") or "").strip(),
        "output_format": _normalize_output_format(str(job_input.get("output_format") or "wav")),
        "speed": _parse_speed(job_input.get("speed", 1.0)),
        "speaker": str(job_input.get("speaker") or "").strip(),
        "instruct_text": str(job_input.get("instruct_text") or "").strip(),
        "language_id": str(job_input.get("language_id") or "").strip(),
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
            speaker=params.get("speaker", ""),
            instruct_text=params.get("instruct_text", ""),
            language_id=params.get("language_id", ""),
        )
        return {
            "audioBase64": base64.b64encode(audio_bytes).decode("ascii"),
            "mimeType": mime_type,
            "outputFormat": used_format,
            "format": used_format,  # Backward-compatible alias
        }
    except Exception as e:
        return {
            "error": str(e),
            "traceback": traceback.format_exc(),
        }


def _resolve_text(job_input: Dict[str, Any]) -> str:
    return str(job_input.get("tts_text") or job_input.get("text") or "").strip()


def _handle_tts(job_input: Dict[str, Any]) -> Dict[str, Any]:
    text = _resolve_text(job_input)
    if not text:
        return {"error": "Missing 'tts_text' or 'text' in input"}

    params = _extract_shared_params(job_input)
    ref_wav_path = None

    try:
        ref_wav_path = _decode_reference_to_temp_wav(job_input)
        return _generate_single(text, params, ref_wav_path)
    finally:
        _cleanup_temp_file(ref_wav_path)


def _handle_tts_batch(job_input: Dict[str, Any]) -> Dict[str, Any]:
    texts = job_input.get("texts")
    if not isinstance(texts, list):
        raise ValueError("texts array is required for tts_batch action.")
    if len(texts) > MAX_BATCH_ITEMS:
        raise ValueError(f"tts_batch supports at most {MAX_BATCH_ITEMS} texts per job.")

    params = _extract_shared_params(job_input)
    ref_wav_path = None
    try:
        ref_wav_path = _decode_reference_to_temp_wav(job_input)
        results: List[Dict[str, Any]] = []

        for idx, item in enumerate(texts):
            item_id = str(idx)
            if not isinstance(item, dict):
                results.append({"id": item_id, "audioBase64": None, "error": "Invalid item format."})
                continue

            item_id = str(item.get("id") or item_id)
            text = str(item.get("text") or item.get("tts_text") or "").strip()
            if not text:
                results.append({"id": item_id, "audioBase64": None, "error": "text is required."})
                continue

            generated = _generate_single(text, params, ref_wav_path)
            if generated.get("error"):
                results.append(
                    {
                        "id": item_id,
                        "audioBase64": None,
                        "error": str(generated.get("error")),
                    }
                )
            else:
                results.append({"id": item_id, **generated, "error": None})

        return {"results": results}
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
    if not isinstance(job_input, dict):
        return {"error": "Job input must be an object."}

    action = str(job_input.get("action") or "").strip().lower()
    if job_input.get("health_check") is True:
        action = "health"
    if not action:
        action = "tts"

    try:
        if action in {"health", "voices"}:
            return _health_payload()
        if action == "tts":
            return _handle_tts(job_input)
        if action == "tts_batch":
            return _handle_tts_batch(job_input)
        return {"error": f"Unsupported action: {action}"}
    except Exception as exc:
        return {
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }

if __name__ == "__main__":
    print("Starting Qwen3-TTS RunPod Worker...")
    runpod.serverless.start({"handler": handler})
