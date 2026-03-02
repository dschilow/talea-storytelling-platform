import os
import torch
import tempfile
import io
import soundfile as sf
import numpy as np

try:
    from qwen_tts import Qwen3TTSModel
except ImportError:
    print("WARNING: qwen-tts module not found.")
    Qwen3TTSModel = None

# ── Model configuration ──────────────────────────────────────────────
# CustomVoice model supports preset speakers (Vivian, Ryan, Serena, etc.)
# and all 10 languages including German.
MODEL_ID = os.environ.get("MODEL_ID", "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice")
MODEL_DIR = os.environ.get("MODEL_DIR", "/opt/models/Qwen3-TTS-CustomVoice")
DEFAULT_SPEAKER = os.environ.get("DEFAULT_SPEAKER", "Vivian")
DEFAULT_LANGUAGE = os.environ.get("DEFAULT_LANGUAGE", "German")

load_path = MODEL_DIR if (os.path.exists(MODEL_DIR) and len(os.listdir(MODEL_DIR)) > 0) else MODEL_ID

qwen_model = None

def load_qwen_model():
    global qwen_model
    print(f"Loading Qwen3-TTS from {load_path}...")
    try:
        qwen_model = Qwen3TTSModel.from_pretrained(
            load_path,
            device_map="cuda:0" if torch.cuda.is_available() else "cpu",
            dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32,
        )
        print("Qwen3-TTS Model loaded successfully.")
        # Log available speakers and languages
        try:
            speakers = qwen_model.get_supported_speakers()
            languages = qwen_model.get_supported_languages()
            print(f"Supported speakers: {speakers}")
            print(f"Supported languages: {languages}")
        except Exception:
            print("Could not query supported speakers/languages (non-fatal).")
    except Exception as e:
        print(f"Failed to load model: {e}")
        import traceback
        traceback.print_exc()

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
    """Generate audio using Qwen3-TTS CustomVoice model.

    Primary mode: generate_custom_voice with preset speakers.
    If reference audio IS provided, attempt generate_voice_clone for voice cloning.
    """
    global qwen_model
    if qwen_model is None:
        raise RuntimeError("Qwen3-TTS model is not loaded.")

    language = _resolve_language(language_id)
    speaker_name = (speaker or DEFAULT_SPEAKER).strip()
    instruct = (instruct_text or "").strip()

    audio_bytes = b""
    mime_type = f"audio/{output_format}"
    used_format = output_format

    try:
        # ── CustomVoice model: always use generate_custom_voice ──────────
        # The CustomVoice model does NOT support generate_voice_clone.
        # Reference audio from the backend is ignored for this model.
        print(f"Using CustomVoice Mode (speaker={speaker_name}, lang={language}, instruct={bool(instruct)})")
        kwargs: dict = dict(
            text=text,
            language=language,
            speaker=speaker_name,
        )
        if instruct:
            kwargs["instruct"] = instruct
        wavs, sr = qwen_model.generate_custom_voice(**kwargs)

        audio_np = wavs[0]  # batch output, take first
        out_io = io.BytesIO()
        sf.write(out_io, audio_np, samplerate=sr, format='WAV')
        audio_bytes = out_io.getvalue()

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise RuntimeError(f"Error during Qwen3-TTS generation: {e}")

    return audio_bytes, mime_type, used_format

load_qwen_model()
