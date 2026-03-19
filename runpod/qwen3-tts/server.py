import importlib.util
import io
import os
import re
import tempfile
import time
from typing import Any, List, Optional, Tuple

import numpy as np
import soundfile as sf
import torch
from pydub import AudioSegment

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
ATTN_IMPLEMENTATION = os.environ.get("QWEN_ATTN_IMPLEMENTATION", "auto").strip()
ENABLE_TORCH_COMPILE = os.environ.get("ENABLE_TORCH_COMPILE", "1").strip() == "1"
REQUIRE_CUDA = os.environ.get("REQUIRE_CUDA", "1").strip() != "0"
ENABLE_BATCH_WARMUP = os.environ.get("ENABLE_BATCH_WARMUP", "1").strip() != "0"
MP3_BITRATE = os.environ.get("QWEN_MP3_BITRATE", "96k").strip() or "96k"
HAS_FLASH_ATTN = importlib.util.find_spec("flash_attn") is not None

load_path = MODEL_DIR if (os.path.exists(MODEL_DIR) and len(os.listdir(MODEL_DIR)) > 0) else MODEL_ID

qwen_model = None
SUPPORTED_SPEAKERS: List[str] = []
SUPPORTED_LANGUAGES: List[str] = []
EMOTION_TAG_PATTERN = re.compile(r"\[(.*?)\]")
EMOTION_STYLE_MAP = {
    "excited": "speak with energetic excitement",
    "dramatic": "speak with dramatic tension",
    "thoughtful": "speak in a thoughtful and reflective tone",
    "curious": "speak with curiosity",
    "whisper": "speak in a soft whispering voice",
    "whispers": "speak in a soft whispering voice",
    "whispering": "speak in a soft whispering voice",
    "gulps": "sound slightly nervous with a subtle gulp",
    "nervous": "speak with slight nervousness",
    "laughs": "add a gentle laugh in the delivery",
    "laugh": "add a gentle laugh in the delivery",
    "sad": "speak with a soft sad tone",
    "happy": "speak with a warm happy tone",
    "angry": "speak with controlled anger",
    "calm": "speak calmly and steadily",
    "serious": "speak in a serious tone",
}


def _style_from_tag(tag: str) -> str:
    normalized = re.sub(r"\s+", " ", tag.strip().lower())
    if not normalized:
        return ""
    mapped = EMOTION_STYLE_MAP.get(normalized)
    if mapped:
        return mapped
    if "pause" in normalized or "beat" in normalized:
        return "use short dramatic pauses where appropriate"
    if "whisper" in normalized:
        return "speak in a soft whispering voice"
    if "excit" in normalized:
        return "speak with energetic excitement"
    if "dramatic" in normalized:
        return "speak with dramatic tension"
    if "laugh" in normalized:
        return "add a gentle laugh in the delivery"
    return ""


def _prepare_text_and_instruct(text: str, base_instruct: str) -> Tuple[str, str]:
    tags: List[str] = []

    def _replace_tag(match: re.Match[str]) -> str:
        raw_tag = (match.group(1) or "").strip()
        normalized = re.sub(r"\s+", " ", raw_tag.lower())
        if normalized:
            tags.append(normalized)
        if "pause" in normalized or "beat" in normalized:
            return " ... "
        return " "

    cleaned = EMOTION_TAG_PATTERN.sub(_replace_tag, text or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if not cleaned:
        cleaned = str(text or "").strip()

    style_parts: List[str] = []
    seen_styles: set[str] = set()
    for tag in tags:
        style = _style_from_tag(tag)
        if style and style not in seen_styles:
            style_parts.append(style)
            seen_styles.add(style)

    instruct_parts: List[str] = []
    if base_instruct.strip():
        instruct_parts.append(base_instruct.strip())
    if style_parts:
        instruct_parts.append(", ".join(style_parts))

    return cleaned, "; ".join(instruct_parts).strip()


def _configure_torch_runtime() -> None:
    if not torch.cuda.is_available():
        return
    try:
        # Favor throughput on modern NVIDIA GPUs.
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True
        torch.backends.cudnn.benchmark = True
        torch.set_float32_matmul_precision("high")
        print("Torch CUDA runtime tuned for throughput (TF32 + cudnn benchmark).")
    except Exception as exc:
        print(f"Torch runtime tuning skipped: {exc}")


def _get_gpu_info() -> dict:
    """Detect GPU compute capability and features."""
    info = {
        "cuda_available": torch.cuda.is_available(),
        "device_count": 0,
        "device_name": "",
        "compute_capability": (0, 0),
        "supports_bf16": False,
        "supports_flash_attn": False,
        "is_blackwell": False,
    }
    if not info["cuda_available"]:
        return info

    info["device_count"] = torch.cuda.device_count()
    if info["device_count"] > 0:
        try:
            info["device_name"] = torch.cuda.get_device_name(0)
        except Exception:
            pass
        try:
            cc = torch.cuda.get_device_capability(0)
            info["compute_capability"] = cc
            # bf16 native support: Ampere (8.0) and newer
            info["supports_bf16"] = cc[0] >= 8
            # flash-attn works on Ampere/Ada/Hopper, but Blackwell (12.x) may
            # not have compatible wheels yet — detect at runtime
            info["supports_flash_attn"] = HAS_FLASH_ATTN and cc[0] >= 8 and cc[0] < 12
            info["is_blackwell"] = cc[0] >= 12
        except Exception:
            pass
    return info


def _ensure_cuda_runtime() -> None:
    gpu = _get_gpu_info()
    print(
        f"CUDA runtime status: available={gpu['cuda_available']} "
        f"devices={gpu['device_count']} device0={gpu['device_name'] or '<none>'} "
        f"compute_capability={gpu['compute_capability'][0]}.{gpu['compute_capability'][1]} "
        f"bf16={gpu['supports_bf16']} flash_attn={gpu['supports_flash_attn']} "
        f"blackwell={gpu['is_blackwell']}"
    )

    if REQUIRE_CUDA and not gpu["cuda_available"]:
        raise RuntimeError(
            "CUDA is required for Qwen3-TTS production inference, but no healthy GPU was detected. "
            "Failing worker startup to avoid extremely slow CPU generation."
        )


def _resolve_model_dtype() -> torch.dtype:
    """Pick the best dtype for the detected GPU.
    - Ampere+ (CC 8.0+): bfloat16 (native hw support, best for transformers)
    - Older GPUs or unknown: float16 (universally supported on all CUDA GPUs)
    - CPU: float32
    """
    if not torch.cuda.is_available():
        return torch.float32
    try:
        cc = torch.cuda.get_device_capability(0)
        if cc[0] >= 8:
            print(f"GPU CC {cc[0]}.{cc[1]} supports bfloat16 natively — using bfloat16.")
            return torch.bfloat16
        print(f"GPU CC {cc[0]}.{cc[1]} does not support bfloat16 natively — using float16.")
        return torch.float16
    except Exception:
        print("Could not detect GPU capability — defaulting to float16.")
        return torch.float16


def _resolve_attn_implementation() -> Optional[str]:
    if not torch.cuda.is_available():
        return None

    gpu = _get_gpu_info()
    requested = (ATTN_IMPLEMENTATION or "").strip().lower()

    if requested in {"", "none", "off", "disabled"}:
        return None

    if requested == "auto":
        # On Blackwell, flash-attn wheels may not exist yet — use SDPA (built into PyTorch)
        if gpu["is_blackwell"]:
            print(
                f"Blackwell GPU detected (CC {gpu['compute_capability'][0]}.{gpu['compute_capability'][1]}). "
                "Using PyTorch SDPA instead of flash_attention_2 for maximum compatibility."
            )
            return "sdpa"
        if HAS_FLASH_ATTN:
            return "flash_attention_2"
        print("flash_attn is not installed. Using SDPA attention implementation.")
        return "sdpa"

    if requested == "flash_attention_2":
        if not HAS_FLASH_ATTN:
            print("flash_attn not installed. Falling back to SDPA.")
            return "sdpa"
        if gpu["is_blackwell"]:
            print("flash_attn may not support Blackwell. Falling back to SDPA.")
            return "sdpa"
        return "flash_attention_2"

    return ATTN_IMPLEMENTATION


def _try_torch_compile(model: Any) -> Any:
    """Apply torch.compile() to inner sub-modules for faster inference on PyTorch 2.x+."""
    if not ENABLE_TORCH_COMPILE:
        print("torch.compile() disabled via ENABLE_TORCH_COMPILE=0.")
        return model
    if not torch.cuda.is_available():
        print("torch.compile() skipped (no CUDA).")
        return model
    try:
        major = int(torch.__version__.split(".")[0])
        if major < 2:
            print(f"torch.compile() requires PyTorch 2.x+ (found {torch.__version__}).")
            return model
    except Exception:
        return model

    # Qwen3TTSModel is a wrapper — torch.compile on the outer object fails silently.
    # Instead, compile individual nn.Module sub-modules that are safe to compile.
    compiled_count = 0
    compile_targets = ["talker", "vocoder", "speaker_encoder", "code_predictor"]
    for attr_name in compile_targets:
        submodule = getattr(model, attr_name, None)
        if submodule is None:
            continue
        if not isinstance(submodule, torch.nn.Module):
            continue
        try:
            compiled = torch.compile(submodule, mode="reduce-overhead", fullgraph=False)
            setattr(model, attr_name, compiled)
            compiled_count += 1
            print(f"torch.compile() applied to model.{attr_name} (mode=reduce-overhead).")
        except Exception as exc:
            print(f"torch.compile() skipped for model.{attr_name}: {exc}")

    if compiled_count > 0:
        print(f"torch.compile() done: {compiled_count} sub-module(s) compiled.")
    else:
        print("torch.compile() skipped: no compatible sub-modules found (non-fatal).")
    return model


def _warmup_model() -> None:
    """Run a short warmup generation to pre-compile CUDA kernels and torch.compile graphs."""
    if qwen_model is None:
        return
    if not torch.cuda.is_available():
        return
    try:
        warmup_start = time.perf_counter()
        with torch.inference_mode():
            qwen_model.generate_custom_voice(
                text="Warmup.",
                language="German",
                speaker=DEFAULT_SPEAKER,
            )
            if ENABLE_BATCH_WARMUP:
                qwen_model.generate_custom_voice(
                    text=["Warmup one.", "Warmup two."],
                    language=["German", "German"],
                    speaker=[DEFAULT_SPEAKER, DEFAULT_SPEAKER],
                )
        torch.cuda.synchronize()
        # Discard warmup output, free VRAM
        torch.cuda.empty_cache()
        elapsed = time.perf_counter() - warmup_start
        print(f"Model warmup completed in {elapsed:.2f}s (single + batch paths primed).")
    except Exception as exc:
        print(f"Model warmup failed (non-fatal): {exc}")


def load_qwen_model() -> None:
    global qwen_model, SUPPORTED_SPEAKERS, SUPPORTED_LANGUAGES
    print(f"Loading Qwen3-TTS from {load_path}...")

    model_dtype = _resolve_model_dtype()
    load_kwargs: dict[str, Any] = {
        "device_map": "cuda:0" if torch.cuda.is_available() else "cpu",
        # NOTE: Qwen3TTSModel uses 'dtype=' (NOT 'torch_dtype=').
        "dtype": model_dtype,
    }
    attn_implementation = _resolve_attn_implementation()
    if torch.cuda.is_available() and attn_implementation:
        load_kwargs["attn_implementation"] = attn_implementation

    print(f"Model load config: dtype={model_dtype}, attn={attn_implementation}")

    # Try primary config → fallback without attn → fallback with float16
    load_attempts = [
        ("primary", dict(load_kwargs)),
    ]
    if load_kwargs.get("attn_implementation"):
        fallback1 = dict(load_kwargs)
        fallback1.pop("attn_implementation", None)
        load_attempts.append(("no-attn-impl", fallback1))
    if model_dtype == torch.bfloat16:
        fallback_fp16 = dict(load_kwargs)
        fallback_fp16.pop("attn_implementation", None)
        fallback_fp16["dtype"] = torch.float16
        load_attempts.append(("float16-fallback", fallback_fp16))

    for attempt_name, kwargs in load_attempts:
        try:
            qwen_model = Qwen3TTSModel.from_pretrained(load_path, **kwargs)
            print(f"Qwen3-TTS Model loaded successfully (attempt={attempt_name}, dtype={kwargs.get('dtype')}, attn={kwargs.get('attn_implementation', 'default')}).")
            break
        except Exception as exc:
            print(f"Model load attempt '{attempt_name}' failed: {exc}")
            if attempt_name == load_attempts[-1][0]:
                print("All model load attempts exhausted.")
                import traceback
                traceback.print_exc()
                return

    # Apply torch.compile for faster inference
    qwen_model = _try_torch_compile(qwen_model)

    # Log available speakers and languages
    try:
        speakers = qwen_model.get_supported_speakers()
        languages = qwen_model.get_supported_languages()
        SUPPORTED_SPEAKERS = [str(s).strip() for s in (speakers or []) if str(s).strip()]
        SUPPORTED_LANGUAGES = [str(l).strip() for l in (languages or []) if str(l).strip()]
        print(f"Supported speakers: {SUPPORTED_SPEAKERS}")
        print(f"Supported languages: {SUPPORTED_LANGUAGES}")
    except Exception:
        SUPPORTED_SPEAKERS = []
        SUPPORTED_LANGUAGES = []
        print("Could not query supported speakers/languages (non-fatal).")

    # Warmup: pre-compile CUDA kernels and torch.compile graphs
    _warmup_model()


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


def _audio_to_bytes(audio_np: Any, sample_rate: int, output_format: str) -> Tuple[bytes, str, str]:
    wav_bytes = _wav_to_bytes(audio_np, sample_rate)
    normalized_format = (output_format or "wav").strip().lower()
    if normalized_format != "mp3":
        return wav_bytes, "audio/wav", "wav"

    audio_segment = AudioSegment.from_file(io.BytesIO(wav_bytes), format="wav")
    out_io = io.BytesIO()
    audio_segment.export(out_io, format="mp3", bitrate=MP3_BITRATE)
    return out_io.getvalue(), "audio/mpeg", "mp3"


def _run_custom_voice_generation(
    texts: List[str],
    language: str,
    speaker_name: str,
    instructs: List[str],
    speaker_names: Optional[List[str]] = None,
) -> Tuple[List[Any], int]:
    resolved_default_speaker = (speaker_name or DEFAULT_SPEAKER).strip() or DEFAULT_SPEAKER
    resolved_speakers: List[str] = []
    if speaker_names and len(speaker_names) == len(texts):
        for speaker in speaker_names:
            normalized = str(speaker or "").strip() or resolved_default_speaker
            resolved_speakers.append(normalized)
    else:
        resolved_speakers = [resolved_default_speaker] * len(texts)

    with torch.inference_mode():
        if len(texts) == 1:
            kwargs: dict[str, Any] = {
                "text": texts[0],
                "language": language,
                "speaker": resolved_speakers[0] if resolved_speakers else resolved_default_speaker,
            }
            single_instruct = instructs[0].strip() if instructs else ""
            if single_instruct:
                kwargs["instruct"] = single_instruct
            wavs, sr = qwen_model.generate_custom_voice(**kwargs)
            return list(wavs), sr

        kwargs = {
            "text": texts,
            "language": [language] * len(texts),
            "speaker": resolved_speakers,
        }
        if any((item or "").strip() for item in instructs):
            kwargs["instruct"] = [str(item or "").strip() for item in instructs]
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
    base_instruct = (instruct_text or "").strip()
    prepared_text, prepared_instruct = _prepare_text_and_instruct(text, base_instruct)

    try:
        started_at = time.perf_counter()
        print(
            f"Using CustomVoice Mode (speaker={speaker_name}, lang={language}, "
            f"instruct={bool(prepared_instruct)})"
        )
        wavs, sr = _run_custom_voice_generation(
            [prepared_text],
            language,
            speaker_name,
            [prepared_instruct],
        )
        audio_bytes, mime_type, used_format = _audio_to_bytes(wavs[0], sr, output_format)
        elapsed = time.perf_counter() - started_at
        print(f"CustomVoice generation completed in {elapsed:.3f}s (chars={len(prepared_text)})")
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
    speakers: List[str] | None = None,
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
    speaker_name = (speaker or DEFAULT_SPEAKER).strip() or DEFAULT_SPEAKER
    base_instruct = (instruct_text or "").strip()
    try:
        started_at = time.perf_counter()
        prepared_texts: List[str] = []
        prepared_instructs: List[str] = []
        prepared_speakers: List[str] = []
        for idx, raw_text in enumerate(safe_texts):
            prepared_text, prepared_instruct = _prepare_text_and_instruct(raw_text, base_instruct)
            prepared_texts.append(prepared_text)
            prepared_instructs.append(prepared_instruct)
            speaker_override = ""
            if speakers and idx < len(speakers):
                speaker_override = str(speakers[idx] or "").strip()
            prepared_speakers.append(speaker_override or speaker_name)

        unique_speakers = sorted({speaker for speaker in prepared_speakers if speaker})
        total_chars = sum(len(t) for t in prepared_texts)

        print(
            f"Using CustomVoice Batch Mode (items={len(safe_texts)}, speakers={unique_speakers[:6]}, "
            f"lang={language}, instruct={any(bool(i) for i in prepared_instructs)}, chars={total_chars})"
        )
        wavs, sr = _run_custom_voice_generation(
            prepared_texts,
            language,
            speaker_name,
            prepared_instructs,
            prepared_speakers,
        )
        outputs: List[Tuple[bytes, str, str]] = []
        for wav in wavs:
            outputs.append(_audio_to_bytes(wav, sr, output_format))
        elapsed = time.perf_counter() - started_at
        chars_per_sec = total_chars / elapsed if elapsed > 0 else 0
        print(
            f"CustomVoice batch generation completed in {elapsed:.3f}s "
            f"(items={len(prepared_texts)}, total_chars={total_chars}, "
            f"chars/s={chars_per_sec:.1f})"
        )
        # Free unused VRAM after batch to keep memory lean for next job
        if torch.cuda.is_available() and total_chars > 2000:
            torch.cuda.empty_cache()
        return outputs
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise RuntimeError(f"Error during Qwen3-TTS batch generation: {exc}")


_ensure_cuda_runtime()
_configure_torch_runtime()
load_qwen_model()
