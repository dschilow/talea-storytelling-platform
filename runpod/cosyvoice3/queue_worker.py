import base64
import os
from typing import Any, Dict, List, Optional

import runpod

import concurrent.futures
import server as cosy_server


def _normalize_output_format(value: str) -> str:
    normalized = (value or "").strip().lower()
    return "mp3" if normalized == "mp3" else "wav"


def _parse_speed(raw: Any) -> float:
    try:
        speed = float(raw)
    except (TypeError, ValueError):
        speed = cosy_server.DEFAULT_SPEED
    if speed <= 0 or speed > 3.0:
        return cosy_server.DEFAULT_SPEED
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

    return cosy_server.save_audio_bytes_to_temp_wav(payload, filename)


def _cleanup_temp_file(path: Optional[str]) -> None:
    if path and os.path.exists(path):
        try:
            os.unlink(path)
        except OSError:
            pass


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


def _extract_shared_params(job_input: Dict[str, Any]) -> Dict[str, Any]:
    """Extract shared TTS parameters from job input."""
    return {
        "prompt_text": str(job_input.get("prompt_text") or "").strip(),
        "instruct_text": str(job_input.get("instruct_text") or "").strip(),
        "emotion": str(job_input.get("emotion") or "").strip(),
        "output_format": _normalize_output_format(str(job_input.get("output_format") or "wav")),
        "speaker": str(job_input.get("speaker") or "").strip(),
        "speed": _parse_speed(job_input.get("speed", cosy_server.DEFAULT_SPEED)),
    }


def _generate_single(
    text: str,
    params: Dict[str, Any],
    ref_wav_path: Optional[str],
) -> Dict[str, Any]:
    """Generate audio for a single text. Returns dict with audioBase64 or error."""
    audio_bytes, mime_type, used_format, used_speaker = cosy_server.generate_audio(
        cosy_server.cosyvoice_model,
        text,
        params["prompt_text"],
        params["instruct_text"],
        params["emotion"],
        params["output_format"],
        ref_wav_path,
        params["speed"],
        params["speaker"],
        cosy_server.default_reference_path,
    )
    return {
        "audioBase64": base64.b64encode(audio_bytes).decode("ascii"),
        "mimeType": mime_type,
        "outputFormat": used_format,
        "speaker": used_speaker or "",
    }


def _handle_tts(job_input: Dict[str, Any]) -> Dict[str, Any]:
    """Handle single TTS request."""
    text = str(job_input.get("text") or "").strip()
    if not text:
        raise ValueError("text is required.")

    params = _extract_shared_params(job_input)

    ref_wav_path: Optional[str] = None
    try:
        ref_wav_path = _decode_reference_to_temp_wav(job_input)
        return _generate_single(text, params, ref_wav_path)
    finally:
        _cleanup_temp_file(ref_wav_path)


def _handle_tts_batch(job_input: Dict[str, Any]) -> Dict[str, Any]:
    """Handle batch TTS request — multiple texts in a single RunPod job.

    Decodes reference audio ONCE and generates audio for each text sequentially,
    keeping the GPU model state warm between chunks. This eliminates per-job
    overhead (scheduling, reference decoding, model initialization).

    Input: {
        action: "tts_batch",
        texts: [{id: str, text: str}, ...],
        prompt_text?, emotion?, output_format?, speed?, speaker?,
        reference_audio_base64?, reference_audio_filename?
    }
    Output: {results: [{id, audioBase64, mimeType, outputFormat, speaker, error?}, ...]}
    """
    texts = job_input.get("texts")
    if not texts or not isinstance(texts, list):
        raise ValueError("texts array is required for tts_batch action.")

    if len(texts) > 50:
        raise ValueError("tts_batch supports at most 50 texts per job.")

    params = _extract_shared_params(job_input)

    # Decode reference audio ONCE for the entire batch
    ref_wav_path: Optional[str] = None
    try:
        ref_wav_path = _decode_reference_to_temp_wav(job_input)

        results: List[Dict[str, Any]] = []
        futures = []

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            for idx, item in enumerate(texts):
                item_id = str(idx)
                try:
                    if not isinstance(item, dict):
                        results.append({"id": item_id, "audioBase64": None, "error": "Invalid item format."})
                        continue

                    item_id = str(item.get("id") or item_id)
                    text = str(item.get("text") or "").strip()

                    if not text:
                        results.append({"id": item_id, "audioBase64": None, "error": "text is required."})
                        continue

                    # Get raw bytes from generator (GPU BLOCKING)
                    audio_bytes, mime_type, used_format, used_speaker = cosy_server.generate_audio(
                        cosy_server.cosyvoice_model,
                        text,
                        params["prompt_text"],
                        params["instruct_text"],
                        params["emotion"],
                        params["output_format"],
                        ref_wav_path,
                        params["speed"],
                        params["speaker"],
                        cosy_server.default_reference_path,
                    )

                    # Process the heavy base64 (and MP3 encoding if applicable) asynchronously
                    # to avoid blocking the GPU for the next chunk
                    def _do_encoding(ab, mt, of, sp, iid):
                        b64 = base64.b64encode(ab).decode("ascii")
                        return {
                            "id": iid,
                            "audioBase64": b64,
                            "mimeType": mt,
                            "outputFormat": of,
                            "speaker": sp or "",
                            "error": None
                        }

                    # Submit to shared executor, does not block loop
                    future = executor.submit(_do_encoding, audio_bytes, mime_type, used_format, used_speaker, item_id)
                    futures.append((idx, item_id, future))

                except Exception as exc:
                    error_msg = cosy_server.trim_error_message(str(exc))
                    print(f"[tts_batch] item {idx + 1}/{len(texts)} ({item_id}) failed: {error_msg}")
                    # Fast dummy future for error
                    def _err(iid, e): return {"id": iid, "audioBase64": None, "error": e}
                    futures.append((idx, item_id, executor.submit(_err, item_id, error_msg)))

            # Wait for all encoding tasks to complete
            for idx, item_id, future in futures:
                try:
                    result = future.result()
                    results.append(result)
                    print(f"[tts_batch] item {idx + 1}/{len(texts)} ({item_id}) done")
                except Exception as e:
                    error_msg = cosy_server.trim_error_message(str(e))
                    print(f"[tts_batch] item {idx + 1}/{len(texts)} ({item_id}) encoding failed: {error_msg}")
                    results.append({"id": item_id, "audioBase64": None, "error": error_msg})

        print(f"[tts_batch] completed {len(results)}/{len(texts)} items")
        return {"results": results}
    finally:
        _cleanup_temp_file(ref_wav_path)




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

    if action == "tts":
        return _handle_tts(job_input)

    if action == "tts_batch":
        return _handle_tts_batch(job_input)

    raise ValueError(f"Unsupported action: {action}")


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
