import io
import os
import tempfile
from typing import Any, List, Tuple

import numpy as np
import soundfile as sf
import torch

try:
    from qwen_tts import Qwen3TTSModel
except ImportError:
    print("WARNING: qwen-tts module not found.")
    Qwen3TTSModel = None

# CustomVoice model supports preset speakers (Vivian, Ryan, Serena, etc.)
# and all 10 languages including German.
MODEL_ID = os.environ.get("MODEL_ID", "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice")
MODEL_DIR = os.environ.get("MODEL_DIR", "/opt/models/Qwen3-TTS-CustomVoice")
DEFAULT_SPEAKER = os.environ.get("DEFAULT_SPEAKER", "Vivian")
DEFAULT_LANGUAGE = os.environ.get("DEFAULT_LANGUAGE", "German")
ATTN_IMPLEMENTATION = os.environ.get("QWEN_ATTN_IMPLEMENTATION", "flash_attention_2").strip()

load_path = MODEL_DIR if (os.path.exists(MODEL_DIR) and len(os.listdir(MODEL_DIR)) > 0) else MODEL_ID

qwen_model = None


def load_qwen_model() -> None:
    global qwen_model
    print(f"Loading Qwen3-TTS from {load_path}...")

    load_kwargs: dict[str, Any] = {
        "device_map": "cuda:0" if torch.cuda.is_available() else "cpu",
        "dtype": torch.bfloat16 if torch.cuda.is_available() else torch.float32,
    }
    if torch.cuda.is_available() and ATTN_IMPLEMENTATION:
        # Prefer FlashAttention-2 if available in the container.
        load_kwargs["attn_implementation"] = ATTN_IMPLEMENTATION

    try:
        qwen_model = Qwen3TTSModel.from_pretrained(load_path, **load_kwargs)
        print("Qwen3-TTS Model loaded successfully.")
    except Exception as exc:
        if load_kwargs.get("attn_implementation"):
            print(f"Model load with attn={load_kwargs['attn_implementation']} failed: {exc}")
            print("Retrying model load with default attention implementation.")
            try:
                load_kwargs.pop("attn_implementation", None)
                qwen_model = Qwen3TTSModel.from_pretrained(load_path, **load_kwargs)
                print("Qwen3-TTS Model loaded successfully (fallback attention).")
            except Exception as fallback_exc:
                print(f"Fallback model load failed: {fallback_exc}")
                import traceback
                traceback.print_exc()
                return
        else:
            print(f"Failed to load model: {exc}")
            import traceback
            traceback.print_exc()
            return

    # Log available speakers and languages
    try:
        speakers = qwen_model.get_supported_speakers()
        languages = qwen_model.get_supported_languages()
        print(f"Supported speakers: {speakers}")
        print(f"Supported languages: {languages}")
    except Exception:
        print("Could not query supported speakers/languages (non-fatal).")


def save_audio_bytes_to_temp_wav(audio_data: bytes, filename: str) -> str:
    path = os.path.join(tempfile.gettempdir(), filename)
    with open(path, "wb") as f:
        f.write(audio_data)
    return path


def _resolve_language(language_id: str = "") -> str:
    """Map short codes or common variants to the full language name Qwen3-TTS expects."""
    lang = (language_id or "").strip().lower()
    mapping = {
        "de": "German", "german": "German", "deutsch": "German",
        "en": "English", "english": "English",
        "zh": "Chinese", "chinese": "Chinese",
        "ja": "Japanese", "japanese": "Japanese",
        "ko": "Korean", "korean": "Korean",
        "fr": "French", "french": "French",
        "es": "Spanish", "spanish": "Spanish",
        "pt": "Portuguese", "portuguese": "Portuguese",
        "ru": "Russian", "russian": "Russian",
        "it": "Italian", "italian": "Italian",
        "auto": "Auto",
    }
    return mapping.get(lang, DEFAULT_LANGUAGE)


def _wav_to_bytes(audio_np: Any, sample_rate: int) -> bytes:
    if hasattr(audio_np, "detach"):
        audio_np = audio_np.detach().cpu().numpy()
    audio_np = np.asarray(audio_np)

    out_io = io.BytesIO()
    sf.write(out_io, audio_np, samplerate=sample_rate, format="WAV")
    return out_io.getvalue()


def _run_custom_voice_generation(
    texts: List[str],
    language: str,
    speaker_name: str,
    instruct: str,
) -> Tuple[List[Any], int]:
    if len(texts) == 1:
        kwargs: dict[str, Any] = {
            "text": texts[0],
            "language": language,
            "speaker": speaker_name,
        }
        if instruct:
            kwargs["instruct"] = instruct
        wavs, sr = qwen_model.generate_custom_voice(**kwargs)
        return list(wavs), sr

    kwargs = {
        "text": texts,
        "language": [language] * len(texts),
        "speaker": [speaker_name] * len(texts),
    }
    if instruct:
        kwargs["instruct"] = [instruct] * len(texts)
    wavs, sr = qwen_model.generate_custom_voice(**kwargs)
    return list(wavs), sr


def generate_audio(
    model=None,
    text: str = "",
    prompt_text: str = "",
    output_format: str = "wav",
    reference_audio_path: str = None,
    speed: float = 1.0,
    speaker: str = "",
    instruct_text: str = "",
    language_id: str = "",
):
    """Generate audio using Qwen3-TTS CustomVoice model."""
    global qwen_model
    if qwen_model is None:
        raise RuntimeError("Qwen3-TTS model is not loaded.")

    language = _resolve_language(language_id)
    speaker_name = (speaker or DEFAULT_SPEAKER).strip()
    instruct = (instruct_text or "").strip()

    mime_type = f"audio/{output_format}"
    used_format = output_format

    try:
        print(f"Using CustomVoice Mode (speaker={speaker_name}, lang={language}, instruct={bool(instruct)})")
        wavs, sr = _run_custom_voice_generation([text], language, speaker_name, instruct)
        audio_bytes = _wav_to_bytes(wavs[0], sr)
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise RuntimeError(f"Error during Qwen3-TTS generation: {exc}")

    return audio_bytes, mime_type, used_format


def generate_audio_batch(
    model=None,
    texts: List[str] | None = None,
    prompt_text: str = "",
    output_format: str = "wav",
    reference_audio_path: str = None,
    speed: float = 1.0,
    speaker: str = "",
    instruct_text: str = "",
    language_id: str = "",
) -> List[Tuple[bytes, str, str]]:
    """Generate multiple audios in one model call for better throughput."""
    global qwen_model
    if qwen_model is None:
        raise RuntimeError("Qwen3-TTS model is not loaded.")

    safe_texts = [str(t or "").strip() for t in (texts or []) if str(t or "").strip()]
    if not safe_texts:
        return []

    language = _resolve_language(language_id)
    speaker_name = (speaker or DEFAULT_SPEAKER).strip()
    instruct = (instruct_text or "").strip()
    mime_type = f"audio/{output_format}"
    used_format = output_format

    try:
        print(
            f"Using CustomVoice Batch Mode (items={len(safe_texts)}, speaker={speaker_name}, "
            f"lang={language}, instruct={bool(instruct)})"
        )
        wavs, sr = _run_custom_voice_generation(safe_texts, language, speaker_name, instruct)
        outputs: List[Tuple[bytes, str, str]] = []
        for wav in wavs:
            outputs.append((_wav_to_bytes(wav, sr), mime_type, used_format))
        return outputs
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise RuntimeError(f"Error during Qwen3-TTS batch generation: {exc}")


load_qwen_model()
