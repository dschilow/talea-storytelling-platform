import base64
import traceback
from typing import Any, Dict, List

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


def _safe_supported_speakers() -> List[str]:
    cached = getattr(qwen_server, "SUPPORTED_SPEAKERS", None)
    if isinstance(cached, list) and cached:
        return [str(s).strip() for s in cached if str(s).strip()]

    model = qwen_server.qwen_model
    if model is None:
        return []
    try:
        speakers = model.get_supported_speakers()
    except Exception:
        return []
    if not isinstance(speakers, (list, tuple)):
        return []
    normalized = [str(s).strip() for s in speakers if str(s).strip()]
    qwen_server.SUPPORTED_SPEAKERS = normalized
    return normalized


def _safe_supported_languages() -> List[str]:
    cached = getattr(qwen_server, "SUPPORTED_LANGUAGES", None)
    if isinstance(cached, list) and cached:
        return [str(l).strip() for l in cached if str(l).strip()]

    model = qwen_server.qwen_model
    if model is None:
        return []
    try:
        languages = model.get_supported_languages()
    except Exception:
        return []
    if not isinstance(languages, (list, tuple)):
        return []
    normalized = [str(l).strip() for l in languages if str(l).strip()]
    qwen_server.SUPPORTED_LANGUAGES = normalized
    return normalized


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
) -> Dict[str, Any]:
    """Generate audio for a single text. Returns dict with audioBase64 or error."""
    try:
        audio_bytes, mime_type, used_format = qwen_server.generate_audio(
            model=qwen_server.qwen_model,
            text=text,
            prompt_text=params["prompt_text"],
            output_format=params["output_format"],
            # CustomVoice mode does not use reference audio.
            reference_audio_path=None,
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
    return _generate_single(text, params)


def _handle_tts_batch(job_input: Dict[str, Any]) -> Dict[str, Any]:
    texts = job_input.get("texts")
    if not isinstance(texts, list):
        raise ValueError("texts array is required for tts_batch action.")
    if len(texts) > MAX_BATCH_ITEMS:
        raise ValueError(f"tts_batch supports at most {MAX_BATCH_ITEMS} texts per job.")

    params = _extract_shared_params(job_input)
    results: List[Dict[str, Any]] = []
    valid_items: List[tuple[str, str, str]] = []

    for idx, item in enumerate(texts):
        item_id = str(idx)
        if not isinstance(item, dict):
            results.append({"id": item_id, "audioBase64": None, "error": "Invalid item format."})
            continue

        item_id = str(item.get("id") or item_id)
        text = str(item.get("text") or item.get("tts_text") or "").strip()
        item_speaker = str(item.get("speaker") or "").strip()
        if not text:
            results.append({"id": item_id, "audioBase64": None, "error": "text is required."})
            continue

        valid_items.append((item_id, text, item_speaker))

    if not valid_items:
        return {"results": results}

    # Fast path: one model call for the entire batch.
    try:
        batch_audio = qwen_server.generate_audio_batch(
            model=qwen_server.qwen_model,
            texts=[text for _, text, _ in valid_items],
            prompt_text=params["prompt_text"],
            output_format=params["output_format"],
            reference_audio_path=None,
            speed=params["speed"],
            speaker=params.get("speaker", ""),
            speakers=[speaker for _, _, speaker in valid_items],
            instruct_text=params.get("instruct_text", ""),
            language_id=params.get("language_id", ""),
        )

        if len(batch_audio) != len(valid_items):
            raise RuntimeError(
                f"Batch output length mismatch: expected {len(valid_items)}, got {len(batch_audio)}"
            )

        for (item_id, _, _), (audio_bytes, mime_type, used_format) in zip(valid_items, batch_audio):
            results.append(
                {
                    "id": item_id,
                    "audioBase64": base64.b64encode(audio_bytes).decode("ascii"),
                    "mimeType": mime_type,
                    "outputFormat": used_format,
                    "format": used_format,
                    "error": None,
                }
            )
        return {"results": results}
    except Exception as batch_exc:
        print(f"[tts_batch] batch inference failed, fallback to per-item mode: {batch_exc}")

    # Fallback path: isolate failures per item.
    for item_id, text, item_speaker in valid_items:
        item_params = dict(params)
        if item_speaker:
            item_params["speaker"] = item_speaker
        generated = _generate_single(text, item_params)
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
