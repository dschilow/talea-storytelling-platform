import subprocess
from flask import Flask, request, send_file, jsonify
from concurrent.futures import ThreadPoolExecutor, as_completed
import io
import os
import sys
import struct
import time
import re
import base64
import uuid
import threading
import json

app = Flask(__name__)

# Fallback paths for local testing vs Docker
MODEL_PATH = os.environ.get('MODEL_PATH', "/app/model.onnx")
PIPER_BINARY = os.environ.get('PIPER_BINARY', "/usr/local/bin/piper_bin/piper")

def _get_env_int(name, default):
    raw = os.environ.get(name)
    if raw is None or str(raw).strip() == "":
        return int(default)
    try:
        return int(raw)
    except Exception:
        return int(default)

def _get_env_float(name, default):
    raw = os.environ.get(name)
    if raw is None or str(raw).strip() == "":
        return float(default)
    try:
        return float(raw)
    except Exception:
        return float(default)

def _get_env_bool(name, default):
    raw = os.environ.get(name)
    if raw is None:
        return bool(default)
    value = str(raw).strip().lower()
    if value in ("1", "true", "yes", "on"):
        return True
    if value in ("0", "false", "no", "off"):
        return False
    return bool(default)

def _clamp(value, minimum, maximum):
    if value < minimum:
        return minimum
    if value > maximum:
        return maximum
    return value

def _clamp_step(previous, target, max_step):
    low = previous - max_step
    high = previous + max_step
    return _clamp(target, low, high)

PIPER_QUALITY_MODE = os.environ.get('PIPER_QUALITY_MODE', 'max').strip().lower()
if PIPER_QUALITY_MODE not in ('fast', 'balanced', 'max'):
    PIPER_QUALITY_MODE = 'max'

_QUALITY_PRESETS = {
    # speed-first profile
    'fast': {
        'max_parallel': 6,
        'max_chunk_chars': 260,
        'max_sentences_per_chunk': 3,
        'job_workers': 4,
        'length_scale': 1.20,
        'noise_scale': 0.56,
        'noise_w': 0.66,
        'silence_scene': 540,
        'silence_dialogue': 390,
        'silence_exclaim': 330,
        'silence_question': 340,
        'silence_period': 260,
        'silence_comma': 180,
        'silence_default': 270,
    },
    # good tradeoff profile
    'balanced': {
        'max_parallel': 4,
        'max_chunk_chars': 340,
        'max_sentences_per_chunk': 2,
        'job_workers': 3,
        'length_scale': 1.30,
        'noise_scale': 0.50,
        'noise_w': 0.60,
        'silence_scene': 620,
        'silence_dialogue': 460,
        'silence_exclaim': 410,
        'silence_question': 430,
        'silence_period': 320,
        'silence_comma': 220,
        'silence_default': 330,
    },
    # highest quality profile (slower)
    'max': {
        'max_parallel': 2,
        'max_chunk_chars': 560,
        'max_sentences_per_chunk': 1,
        'job_workers': 2,
        'length_scale': 1.38,
        'noise_scale': 0.44,
        'noise_w': 0.54,
        'silence_scene': 700,
        'silence_dialogue': 520,
        'silence_exclaim': 450,
        'silence_question': 500,
        'silence_period': 380,
        'silence_comma': 260,
        'silence_default': 360,
    },
}
_QUALITY = _QUALITY_PRESETS[PIPER_QUALITY_MODE]

# ── Phoneme-level silence: Piper natively pauses at punctuation ──────────────
# When enabled, inter-chunk silence is reduced because Piper already adds
# natural pauses at sentence-ending punctuation within synthesized audio.
ENABLE_PHONEME_SILENCE = _get_env_bool('ENABLE_PHONEME_SILENCE', True)

if ENABLE_PHONEME_SILENCE:
    _QUALITY = dict(_QUALITY)  # copy to avoid mutating preset
    # Piper phoneme_silence adds ~350ms at periods, ~400ms at questions, etc.
    # Reduce inter-chunk silence to avoid double pausing.
    _QUALITY['silence_scene'] = max(50, _QUALITY['silence_scene'] - 280)
    _QUALITY['silence_dialogue'] = max(50, _QUALITY['silence_dialogue'] - 220)
    _QUALITY['silence_exclaim'] = max(50, _QUALITY['silence_exclaim'] - 300)
    _QUALITY['silence_question'] = max(50, _QUALITY['silence_question'] - 350)
    _QUALITY['silence_period'] = max(50, _QUALITY['silence_period'] - 300)
    _QUALITY['silence_comma'] = max(30, _QUALITY['silence_comma'] - 160)
    _QUALITY['silence_default'] = max(50, _QUALITY['silence_default'] - 220)

# Number of parallel Piper processes per request
MAX_PARALLEL_PIPER = _get_env_int('MAX_PARALLEL_PIPER', _QUALITY['max_parallel'])

# Max characters per chunk. Larger chunks preserve prosody but are slower.
MAX_CHUNK_CHARS = _get_env_int('MAX_CHUNK_CHARS', _QUALITY['max_chunk_chars'])
MAX_SENTENCES_PER_CHUNK = _get_env_int('MAX_SENTENCES_PER_CHUNK', _QUALITY['max_sentences_per_chunk'])

# Default synthesis values when request does not provide explicit values.
DEFAULT_LENGTH_SCALE = _get_env_float('DEFAULT_LENGTH_SCALE', _QUALITY['length_scale'])
DEFAULT_NOISE_SCALE = _get_env_float('DEFAULT_NOISE_SCALE', _QUALITY['noise_scale'])
DEFAULT_NOISE_W = _get_env_float('DEFAULT_NOISE_W', _QUALITY['noise_w'])

# Pause lengths for chunk transitions.
SILENCE_SCENE_MS = _get_env_int('SILENCE_SCENE_MS', _QUALITY['silence_scene'])
SILENCE_DIALOGUE_MS = _get_env_int('SILENCE_DIALOGUE_MS', _QUALITY['silence_dialogue'])
SILENCE_EXCLAIM_MS = _get_env_int('SILENCE_EXCLAIM_MS', _QUALITY['silence_exclaim'])
SILENCE_QUESTION_MS = _get_env_int('SILENCE_QUESTION_MS', _QUALITY['silence_question'])
SILENCE_PERIOD_MS = _get_env_int('SILENCE_PERIOD_MS', _QUALITY['silence_period'])
SILENCE_COMMA_MS = _get_env_int('SILENCE_COMMA_MS', _QUALITY['silence_comma'])
SILENCE_DEFAULT_MS = _get_env_int('SILENCE_DEFAULT_MS', _QUALITY['silence_default'])

# Optional quality refinements
ENABLE_DYNAMIC_CHUNK_TUNING = _get_env_bool('ENABLE_DYNAMIC_CHUNK_TUNING', True)
ENABLE_OUTPUT_NORMALIZATION = _get_env_bool('ENABLE_OUTPUT_NORMALIZATION', True)
OUTPUT_TARGET_PEAK = _get_env_float('OUTPUT_TARGET_PEAK', 0.93)
OUTPUT_EDGE_FADE_MS = _get_env_int('OUTPUT_EDGE_FADE_MS', 6)
ENABLE_CHARACTER_VOICE_VARIATION = _get_env_bool('ENABLE_CHARACTER_VOICE_VARIATION', True)
ENABLE_EMOTION_VARIATION = _get_env_bool('ENABLE_EMOTION_VARIATION', True)
DEBUG_TTS_PROSODY = _get_env_bool('DEBUG_TTS_PROSODY', False)

# ── Emotional model (Thorsten Emotional with 8 emotion speakers) ─────────────
EMOTIONAL_MODEL_PATH = os.environ.get('EMOTIONAL_MODEL_PATH', "/app/emotional_model.onnx")
ENABLE_EMOTIONAL_MODEL = _get_env_bool('ENABLE_EMOTIONAL_MODEL', True)

# ── FFmpeg post-processing for broadcast quality ─────────────────────────────
ENABLE_FFMPEG_POSTPROCESS = _get_env_bool('ENABLE_FFMPEG_POSTPROCESS', True)
FFMPEG_FILTER_CHAIN = os.environ.get('FFMPEG_FILTER_CHAIN',
    'highpass=f=60,'
    'acompressor=threshold=0.06:ratio=2.5:attack=8:release=150:makeup=1.5,'
    'alimiter=limit=0.95'
)

# ── Phoneme silence values (injected into model config at startup) ───────────
PHONEME_SILENCE_COMMA = _get_env_float('PHONEME_SILENCE_COMMA', 0.20)
PHONEME_SILENCE_PERIOD = _get_env_float('PHONEME_SILENCE_PERIOD', 0.35)
PHONEME_SILENCE_QUESTION = _get_env_float('PHONEME_SILENCE_QUESTION', 0.42)
PHONEME_SILENCE_EXCLAIM = _get_env_float('PHONEME_SILENCE_EXCLAIM', 0.35)
PHONEME_SILENCE_COLON = _get_env_float('PHONEME_SILENCE_COLON', 0.18)
PHONEME_SILENCE_SEMICOLON = _get_env_float('PHONEME_SILENCE_SEMICOLON', 0.22)
PHONEME_SILENCE_ELLIPSIS = _get_env_float('PHONEME_SILENCE_ELLIPSIS', 0.55)

# Guard rails and smoothing to avoid sudden "too fast" speech spikes.
MIN_LENGTH_SCALE = _get_env_float('MIN_LENGTH_SCALE', 1.00)
MAX_LENGTH_SCALE = _get_env_float('MAX_LENGTH_SCALE', 1.95)
MIN_NOISE_SCALE = _get_env_float('MIN_NOISE_SCALE', 0.05)
MAX_NOISE_SCALE = _get_env_float('MAX_NOISE_SCALE', 1.30)
MIN_NOISE_W = _get_env_float('MIN_NOISE_W', 0.05)
MAX_NOISE_W = _get_env_float('MAX_NOISE_W', 1.30)
MIN_RELATIVE_LENGTH_MULT = _get_env_float('MIN_RELATIVE_LENGTH_MULT', 0.94)
MAX_RELATIVE_LENGTH_MULT = _get_env_float('MAX_RELATIVE_LENGTH_MULT', 1.10)

# Extra pacing control for long chunks so narration does not become sluggish.
LONG_CHUNK_THRESHOLD = _get_env_int('LONG_CHUNK_THRESHOLD', 180)
LONG_CHUNK_LENGTH_MULT = _get_env_float('LONG_CHUNK_LENGTH_MULT', 0.96)

ENABLE_PROSODY_SMOOTHING = _get_env_bool('ENABLE_PROSODY_SMOOTHING', True)
MAX_LENGTH_SCALE_STEP = _get_env_float('MAX_LENGTH_SCALE_STEP', 0.12)
MAX_NOISE_SCALE_STEP = _get_env_float('MAX_NOISE_SCALE_STEP', 0.08)
MAX_NOISE_W_STEP = _get_env_float('MAX_NOISE_W_STEP', 0.08)

# Optional custom pronunciation map.
# Format: "Name=nahm-eh;Talea=ta-lee-ah"
CUSTOM_PRONUNCIATIONS_RAW = os.environ.get('CUSTOM_PRONUNCIATIONS', '').strip()
CUSTOM_PRONUNCIATIONS = []
if CUSTOM_PRONUNCIATIONS_RAW:
    for item in CUSTOM_PRONUNCIATIONS_RAW.split(';'):
        part = item.strip()
        if not part or '=' not in part:
            continue
        source, target = part.split('=', 1)
        source = source.strip()
        target = target.strip()
        if source and target:
            pattern = re.compile(r'\b' + re.escape(source) + r'\b', re.IGNORECASE)
            CUSTOM_PRONUNCIATIONS.append((pattern, target))

# Optional character-specific voice profile overrides.
# Format:
#   CHARACTER_VOICE_PROFILES="emma=1.08,0.02,0.03;leo=0.94,-0.01,-0.02"
# Values are:
#   length_multiplier, noise_delta, noise_w_delta
CHARACTER_VOICE_PROFILES_RAW = os.environ.get('CHARACTER_VOICE_PROFILES', '').strip()

# ── Async job registry ────────────────────────────────────────────────────────
# Stores: { job_id: { "status": "processing"|"ready"|"error", "result": bytes|None, "error": str|None, "created": float } }
_jobs: dict = {}
_jobs_lock = threading.Lock()

# Background thread pool for async job processing (separate from per-request parallelism)
JOB_EXECUTOR_WORKERS = _get_env_int('JOB_EXECUTOR_WORKERS', _QUALITY['job_workers'])
_job_executor = ThreadPoolExecutor(max_workers=JOB_EXECUTOR_WORKERS, thread_name_prefix="tts-job")

# TTL for completed jobs: 10 minutes (client has time to fetch the result)
JOB_TTL_SECONDS = 600

# ── Emotion-to-speaker-ID mapping for thorsten_emotional model ────────────────
# Speaker IDs: amused=0, angry=1, disgusted=2, drunk=3, neutral=4,
#              sleepy=5, surprised=6, whisper=7
EMOTION_SPEAKER_MAP = {
    'anger': 1,       # angry
    'joy': 0,         # amused
    'sadness': 5,     # sleepy (closest match)
    'fear': 6,        # surprised
    'calm': 4,        # neutral
    'suspense': 7,    # whisper
}

# Check if model exists
if not os.path.exists(MODEL_PATH):
    print(f"WARNING: Model not found at {MODEL_PATH}", file=sys.stderr)

if ENABLE_EMOTIONAL_MODEL and not os.path.exists(EMOTIONAL_MODEL_PATH):
    print(f"WARNING: Emotional model not found at {EMOTIONAL_MODEL_PATH}, disabling", file=sys.stderr)
    ENABLE_EMOTIONAL_MODEL = False

# ── Inject phoneme_silence into model configs at startup ─────────────────────
def _inject_phoneme_silence():
    """Inject phoneme_silence into model config JSON for punctuation-aware pausing.
    This makes Piper natively pause at commas, periods, questions, etc."""
    if not ENABLE_PHONEME_SILENCE:
        return

    phoneme_silence = {
        ',': PHONEME_SILENCE_COMMA,
        '.': PHONEME_SILENCE_PERIOD,
        '?': PHONEME_SILENCE_QUESTION,
        '!': PHONEME_SILENCE_EXCLAIM,
        ':': PHONEME_SILENCE_COLON,
        ';': PHONEME_SILENCE_SEMICOLON,
        '\u2026': PHONEME_SILENCE_ELLIPSIS,   # Unicode ellipsis …
    }

    configs_to_update = [MODEL_PATH + '.json']
    if ENABLE_EMOTIONAL_MODEL:
        configs_to_update.append(EMOTIONAL_MODEL_PATH + '.json')

    for config_path in configs_to_update:
        if not os.path.exists(config_path):
            continue
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            if 'inference' not in config:
                config['inference'] = {}
            config['inference']['phoneme_silence'] = {
                k: round(v, 3) for k, v in phoneme_silence.items()
            }
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            print(f"Injected phoneme_silence into {config_path}: {phoneme_silence}", file=sys.stderr)
        except Exception as e:
            print(f"WARNING: Failed to inject phoneme_silence into {config_path}: {e}", file=sys.stderr)

_inject_phoneme_silence()

print(
    (
        "Piper config: "
        f"mode={PIPER_QUALITY_MODE}, "
        f"max_parallel={MAX_PARALLEL_PIPER}, "
        f"max_chunk_chars={MAX_CHUNK_CHARS}, "
        f"max_sentences_per_chunk={MAX_SENTENCES_PER_CHUNK}, "
        f"default_length_scale={DEFAULT_LENGTH_SCALE}, "
        f"default_noise_scale={DEFAULT_NOISE_SCALE}, "
        f"default_noise_w={DEFAULT_NOISE_W}, "
        f"job_workers={JOB_EXECUTOR_WORKERS}, "
        f"dynamic_tuning={ENABLE_DYNAMIC_CHUNK_TUNING}, "
        f"smoothing={ENABLE_PROSODY_SMOOTHING}, "
        f"output_normalization={ENABLE_OUTPUT_NORMALIZATION}, "
        f"character_variation={ENABLE_CHARACTER_VOICE_VARIATION}, "
        f"emotion_variation={ENABLE_EMOTION_VARIATION}, "
        f"custom_pronunciations={len(CUSTOM_PRONUNCIATIONS)}, "
        f"phoneme_silence={ENABLE_PHONEME_SILENCE}, "
        f"emotional_model={ENABLE_EMOTIONAL_MODEL}, "
        f"ffmpeg_postprocess={ENABLE_FFMPEG_POSTPROCESS}"
    ),
    file=sys.stderr,
)

def _to_float(raw, default):
    if raw is None:
        return float(default)
    try:
        return float(raw)
    except Exception:
        return float(default)

def _parse_character_voice_profiles(raw):
    profiles = {}
    if not raw:
        return profiles

    for item in raw.split(';'):
        part = item.strip()
        if not part or '=' not in part:
            continue
        name, values = part.split('=', 1)
        name = name.strip().lower()
        entries = [v.strip() for v in values.split(',')]
        if len(entries) != 3:
            continue
        length_multiplier = _to_float(entries[0], 1.0)
        noise_delta = _to_float(entries[1], 0.0)
        noise_w_delta = _to_float(entries[2], 0.0)
        profiles[name] = (length_multiplier, noise_delta, noise_w_delta)
    return profiles

CHARACTER_VOICE_PROFILES = _parse_character_voice_profiles(CHARACTER_VOICE_PROFILES_RAW)
if CHARACTER_VOICE_PROFILES:
    print(f"Character voice profiles loaded: {len(CHARACTER_VOICE_PROFILES)}", file=sys.stderr)

def _speaker_hash_profile(name):
    # Deterministic variation for speakers without explicit profile.
    # Keeps one base model while giving distinct voice flavor per character.
    seed = 0
    for index, char in enumerate(name):
        seed += (index + 1) * ord(char)

    length_multiplier = 0.96 + ((seed % 9) / 100.0)  # 0.96..1.04
    noise_delta = (((seed // 17) % 11) - 5) / 100.0   # -0.05..0.05
    noise_w_delta = (((seed // 255) % 11) - 5) / 100.0
    return length_multiplier, noise_delta, noise_w_delta

def _extract_speaker_hint(chunk):
    name_pattern = r'([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9_-]{1,24})'

    # Pattern 1: Name: "..."
    match = re.search(r'\b' + name_pattern + r'\s*:\s*"', chunk, re.IGNORECASE)
    if match:
        return match.group(1).lower()

    # Pattern 2: "...", sagte Name
    speech_verbs = (
        r'sagte|fragte|antwortete|rief|schrie|fl[üu]sterte|murmelte|'
        r'meinte|br[üu]llte|jammerte|lachte|seufzte|knurrte|wisperte|hauchte'
    )
    match = re.search(r'"\s*,?\s*(?:' + speech_verbs + r')\s+' + name_pattern + r'\b', chunk, re.IGNORECASE)
    if match:
        return match.group(1).lower()

    # Pattern 3: Name sagte: "..."
    match = re.search(r'\b' + name_pattern + r'\s+(?:' + speech_verbs + r')\b', chunk, re.IGNORECASE)
    if match:
        return match.group(1).lower()

    return None

def _detect_emotion(chunk):
    """Detect the dominant emotion from text content. Returns emotion name or None."""
    text = chunk.strip()
    lower = text.lower()

    def contains(pattern):
        return re.search(pattern, lower, re.IGNORECASE) is not None

    scores = {
        'anger': 0,
        'joy': 0,
        'sadness': 0,
        'fear': 0,
        'calm': 0,
        'suspense': 0,
    }

    exclaim_count = text.count('!')
    question_count = text.count('?')
    if exclaim_count >= 2:
        scores['anger'] += 2
        scores['joy'] += 1
    elif exclaim_count == 1:
        scores['joy'] += 1
        scores['anger'] += 1
    if question_count >= 2:
        scores['fear'] += 1
        scores['suspense'] += 1
    elif question_count == 1:
        scores['suspense'] += 1
    if '...' in text or '\u2026' in text:
        scores['suspense'] += 2
        scores['calm'] += 1

    # Lexical cues — expanded German vocabulary
    if contains(r'\b(schrie|br[üu]llte|knurrte|wut|zorn|fauchte|w[üu]tend|tobte|stampfte|donnerte)\b'):
        scores['anger'] += 3
    if contains(r'\b(lachte|jubelte|grinste|freute|strahlte|fr[öo]hlich|kicherte|jauchzte|hüpfte)\b'):
        scores['joy'] += 3
    if contains(r'\b(weinte|schluchzte|traurig|seufzte|leise|verzweifelt|tr[äa]ne|jammerte|klagte)\b'):
        scores['sadness'] += 3
    if contains(r'\b(zitterte|aengstlich|ängstlich|panik|furcht|flucht|erschrocken|bebte|schauderte)\b'):
        scores['fear'] += 3
    if contains(r'\b(fluesterte|flüsterte|ruhig|sanft|behutsam|gelassen|still|friedlich|sachte)\b'):
        scores['calm'] += 3
    if contains(r'\b(pl[öo]tzlich|dunkel|schatten|geheimnis|lauerte|schlich|unheimlich|geisterhaft)\b'):
        scores['suspense'] += 3

    emotion = max(scores, key=lambda key: scores[key])
    if scores[emotion] == 0:
        return None
    return emotion


def _emotion_tuning_from_text(chunk):
    """Return prosody adjustments (length_mult, noise_delta, noise_w_delta) based on emotion."""
    if not ENABLE_EMOTION_VARIATION:
        return 1.0, 0.0, 0.0

    emotion = _detect_emotion(chunk)
    if not emotion:
        return 1.0, 0.0, 0.0

    # length_multiplier, noise_delta, noise_w_delta
    profiles = {
        'anger': (0.97, 0.10, 0.07),
        'joy': (0.99, 0.08, 0.06),
        'sadness': (1.10, -0.08, -0.06),
        'fear': (1.01, 0.08, 0.06),
        'calm': (1.06, -0.06, -0.05),
        'suspense': (1.08, -0.05, -0.04),
    }
    return profiles.get(emotion, (1.0, 0.0, 0.0))


def _select_model_for_chunk(chunk):
    """Select model path and optional speaker ID based on content emotion.
    Uses thorsten_emotional model for dialogue with clear emotion,
    thorsten-high model for narration and neutral content."""
    if not ENABLE_EMOTIONAL_MODEL:
        return MODEL_PATH, None
    if not os.path.exists(EMOTIONAL_MODEL_PATH):
        return MODEL_PATH, None

    has_dialogue = '"' in chunk.strip()
    emotion = _detect_emotion(chunk)

    # Use emotional model for dialogue with a detected emotion
    if has_dialogue and emotion and emotion in EMOTION_SPEAKER_MAP:
        return EMOTIONAL_MODEL_PATH, EMOTION_SPEAKER_MAP[emotion]

    # Narration with very strong emotion also benefits from emotional model
    if not has_dialogue and emotion in ('anger', 'fear', 'suspense'):
        return EMOTIONAL_MODEL_PATH, EMOTION_SPEAKER_MAP[emotion]

    return MODEL_PATH, None

def _split_sentences_preserve_quotes(text):
    """Split text into sentence-like units while keeping closing quotes with sentence-ending punctuation."""
    pattern = re.compile(r'.+?(?:[.!?]+(?:["\')\]]+)?)(?=\s+|$)|.+$', re.DOTALL)
    sentences = []
    for match in pattern.finditer(text):
        sentence = match.group(0).strip()
        if sentence:
            sentences.append(sentence)
    return sentences

def _apply_custom_pronunciations(text):
    if not CUSTOM_PRONUNCIATIONS:
        return text
    updated = text
    for pattern, replacement in CUSTOM_PRONUNCIATIONS:
        updated = pattern.sub(replacement, updated)
    return updated

def _split_overlong_sentence(sentence, max_chars):
    sentence = sentence.strip()
    if not sentence:
        return []
    if len(sentence) <= max_chars:
        return [sentence]

    parts = []
    queue = [sentence]
    separators = [', ', '; ', ': ', ' - ', ' – ', ' und ', ' oder ', ' aber ']

    while queue:
        item = queue.pop(0).strip()
        if not item:
            continue
        if len(item) <= max_chars:
            parts.append(item)
            continue

        split_done = False
        center = len(item) // 2

        for sep in separators:
            positions = [m.start() for m in re.finditer(re.escape(sep), item)]
            if not positions:
                continue
            split_at = min(positions, key=lambda pos: abs(pos - center))
            left = item[:split_at + len(sep) - 1].strip()
            right = item[split_at + len(sep):].strip()
            if left and right and left != item and right != item:
                queue.insert(0, right)
                queue.insert(0, left)
                split_done = True
                break

        if split_done:
            continue

        hard_split = item.rfind(' ', 0, max_chars)
        if hard_split < int(max_chars * 0.55):
            hard_split = item.find(' ', max_chars)

        if hard_split == -1:
            parts.append(item)
            continue

        left = item[:hard_split].strip()
        right = item[hard_split + 1:].strip()
        if left:
            queue.insert(0, left)
        if right:
            queue.insert(1 if left else 0, right)

    return parts

def _enhance_story_text_for_tts(text):
    # Parenthetical fragments usually sound better with short pauses.
    text = re.sub(r'\(([^)]+)\)', r', \1,', text)

    # Chapter titles and section headers should become spoken sentence starts.
    text = re.sub(r'(?im)^\s*(kapitel\s+\d+)\s*[:\-]\s*', r'\1. ', text)
    text = re.sub(r'(?im)^\s*(szene\s+\d+)\s*[:\-]\s*', r'\1. ', text)

    # Semicolons are often swallowed in TTS, convert to clearer sentence breaks.
    text = re.sub(r';\s*', '. ', text)

    # Protect spoken rhythm for common symbol patterns.
    text = re.sub(r'\s*/\s*', ' oder ', text)
    text = re.sub(r'\s*&\s*', ' und ', text)

    # Normalize punctuation bursts.
    if ENABLE_PHONEME_SILENCE:
        # With phoneme_silence, each punctuation mark adds its own pause.
        # Reduce to single marks to avoid excessive pausing.
        text = re.sub(r'!{2,}', '!', text)
        text = re.sub(r'\?{2,}', '?', text)
    else:
        text = re.sub(r'!{3,}', '!!', text)
        text = re.sub(r'\?{3,}', '??', text)
    # Convert triple dots to Unicode ellipsis for single phoneme_silence pause
    text = re.sub(r'\.{3,}', '\u2026', text)

    # Add a small pause before abrupt topic changes.
    text = re.sub(r'([.!?])\s*(Doch|Aber|Plötzlich|Dann)\b', r'\1 … \2', text)

    return text

def _derive_chunk_params(chunk, base_length, base_noise, base_noise_w):
    normalized = chunk.strip()
    length = base_length
    noise = base_noise
    noise_w = base_noise_w

    # Global emotion shaping.
    emotion_length, emotion_noise, emotion_noise_w = _emotion_tuning_from_text(normalized)
    length *= emotion_length
    noise += emotion_noise
    noise_w += emotion_noise_w

    if ENABLE_DYNAMIC_CHUNK_TUNING:
        has_dialogue = '"' in normalized
        has_exclamation = normalized.endswith('!!') or normalized.endswith('!')
        has_question = normalized.endswith('?')
        has_suspense = normalized.endswith('...') or normalized.endswith('\u2026') or '...' in normalized or '\u2026' in normalized
        is_short = len(normalized) < 70

        if has_dialogue:
            length *= 1.03
            noise += 0.04
            noise_w += 0.04

        if has_exclamation:
            length *= 0.98
            noise += 0.10
            noise_w += 0.08

        if has_question:
            length *= 1.00
            noise += 0.05
            noise_w += 0.04

        if has_suspense:
            length *= 1.05
            noise -= 0.05
            noise_w -= 0.04

        if is_short and not has_exclamation:
            length *= 1.00

        # Long narrative chunks should not drift too slow.
        if len(normalized) >= LONG_CHUNK_THRESHOLD and not has_exclamation:
            length *= LONG_CHUNK_LENGTH_MULT

    # Character-based variation (deterministic per speaker).
    if ENABLE_CHARACTER_VOICE_VARIATION:
        speaker = _extract_speaker_hint(normalized)
        if speaker:
            if speaker in CHARACTER_VOICE_PROFILES:
                char_length, char_noise, char_noise_w = CHARACTER_VOICE_PROFILES[speaker]
            else:
                char_length, char_noise, char_noise_w = _speaker_hash_profile(speaker)
            length *= char_length
            noise += char_noise
            noise_w += char_noise_w

    relative_min = base_length * MIN_RELATIVE_LENGTH_MULT
    relative_max = base_length * MAX_RELATIVE_LENGTH_MULT
    if relative_min > relative_max:
        relative_min, relative_max = relative_max, relative_min

    length = _clamp(length, relative_min, relative_max)
    length = _clamp(length, MIN_LENGTH_SCALE, MAX_LENGTH_SCALE)
    noise = _clamp(noise, MIN_NOISE_SCALE, MAX_NOISE_SCALE)
    noise_w = _clamp(noise_w, MIN_NOISE_W, MAX_NOISE_W)
    return length, noise, noise_w

def preprocess_text(text):
    """Normalize text for better TTS pronunciation."""
    # ── Abbreviations ──
    text = re.sub(r'\bz\.B\.\b', 'zum Beispiel', text)
    text = re.sub(r'\bd\.h\.\b', 'das heißt', text)
    text = re.sub(r'\bu\.a\.\b', 'unter anderem', text)
    text = re.sub(r'\bbzw\.\b', 'beziehungsweise', text)
    text = re.sub(r'\busw\.\b', 'und so weiter', text)
    text = re.sub(r'\bu\.s\.w\.\b', 'und so weiter', text)
    text = re.sub(r'\bca\.\b', 'circa', text)
    text = re.sub(r'\bDr\.\b', 'Doktor', text)
    text = re.sub(r'\bProf\.\b', 'Professor', text)
    text = re.sub(r'\bHr\.\b', 'Herr', text)
    text = re.sub(r'\bFr\.\b', 'Frau', text)
    text = re.sub(r'\bNr\.\b', 'Nummer', text)
    text = re.sub(r'\bSt\.\b', 'Sankt', text)
    text = re.sub(r'\bStr\.\b', 'Straße', text)
    text = re.sub(r'\bo\.ä\.\b', 'oder ähnliches', text)
    text = re.sub(r'\bs\.o\.\b', 'siehe oben', text)
    text = re.sub(r'\bggf\.\b', 'gegebenenfalls', text)
    text = re.sub(r'\bevtl\.\b', 'eventuell', text)
    text = re.sub(r'\bMio\.\b', 'Millionen', text)
    text = re.sub(r'\bMrd\.\b', 'Milliarden', text)
    # ── Time expressions: 14:30 → vierzehn Uhr dreißig ──
    def time_to_german(m):
        h = int(m.group(1))
        mins = int(m.group(2))
        result = number_to_german(h) + ' Uhr'
        if mins > 0:
            result += ' ' + number_to_german(mins)
        return result
    text = re.sub(r'\b(\d{1,2}):(\d{2})\b', time_to_german, text)
    # ── Normalize German quotation marks to ASCII for consistent handling ──
    text = text.replace('\u201e', '"')   # „ → "
    text = text.replace('\u201c', '"')   # " → "
    text = text.replace('\u201d', '"')   # " → "
    text = text.replace('\u00bb', '"')   # » → "
    text = text.replace('\u00ab', '"')   # « → "
    text = text.replace('\u203a', '"')   # › → "
    text = text.replace('\u2039', '"')   # ‹ → "
    # ── Remove markdown artifacts ──
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'#{1,6}\s*', '', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # ── Scene transition markers → pause ──
    text = re.sub(r'^[\*\-]{3,}\s*$', '...', text, flags=re.MULTILINE)
    # ── Ordinal numbers: 1. → erster, 2. → zweiter (context: chapter headings) ──
    text = re.sub(r'\bvon\s+(\d+)\s+bis\s+(\d+)\b',
                  lambda m: f'von {number_to_german(int(m.group(1)))} bis {number_to_german(int(m.group(2)))}', text)
    # ── Common German expressions for natural reading ──
    text = re.sub(r'\bz\.T\.\b', 'zum Teil', text)
    text = re.sub(r'\bv\.a\.\b', 'vor allem', text)
    text = re.sub(r'\bi\.d\.R\.\b', 'in der Regel', text)
    text = re.sub(r'\bsog\.\b', 'sogenannt', text)
    text = re.sub(r'\behem\.\b', 'ehemalig', text)
    text = re.sub(r'\babs\.\b', 'absolut', text)
    # ── Normalize dashes to breath pauses ──
    text = text.replace('\u2014', ', ')  # em-dash
    text = text.replace('\u2013', ', ')  # en-dash
    # ── Whitespace cleanup ──
    text = re.sub(r'\n+', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()

def prepare_for_tts(text):
    """
    Transform story text into a format that Piper TTS reads more naturally.
    Adds micro-pauses via punctuation, expands difficult words, slows dialogue.
    The original text in the frontend stays unchanged — this only affects audio.
    """
    # ── 1. Paragraph breaks → sentence-ending pause ──
    # Piper ignores \n\n. Replace with period + newline so it creates a real pause.
    # Do this FIRST so later rules operate on clean text.
    text = re.sub(r'\n\n+', '.\n\n', text)
    # Clean up double periods (but preserve intentional ellipses)
    text = re.sub(r'\.{2}(?!\.)', '.', text)

    # ── 2. Dialogue pauses: breathing room around quoted speech ──
    # Insert pause before opening quote when preceded by sentence-ending punctuation
    text = re.sub(r'([.!?])\s*"', r'\1 ... "', text)
    # Pause after closing quote before speech attribution verbs
    attribution_verbs = (
        'sagte|rief|flüsterte|fragte|antwortete|meinte|murmelte|schrie|lachte|'
        'erklärte|bat|dachte|brummte|seufzte|stöhnte|jubelte|wisperte|knurrte|'
        'hauchte|schluchzte|jammerte|staunte|schnaubte|zischte|sang|brüllte'
    )
    text = re.sub(
        r'([.!?])"\s*,?\s*(' + attribution_verbs + r')',
        r'\1" ... \2', text
    )
    # Pause before opening quote when starting speech mid-narration
    text = re.sub(r'(\w{3,}):\s*"', r'\1: ... "', text)

    # ── 3. Exclamation/question emphasis ──
    # When phoneme_silence is active, Piper handles punctuation pauses natively.
    # Doubling would cause double pauses (e.g. !! = 2× phoneme_silence).
    if not ENABLE_PHONEME_SILENCE:
        text = re.sub(r'!\s', '!! ', text)
        text = re.sub(r'\?\s', '?? ', text)

    # ── 4. Comma breathing: add commas at natural breath points ──
    # Before subordinate conjunctions
    text = re.sub(
        r'(\w{4,})\s+(wenn|als|weil|dass|aber|doch|denn|obwohl|damit|bevor|nachdem|während|sobald|ob|falls|solange)\s',
        r'\1, \2 ', text
    )
    # Before "und" / "oder" in longer clauses (only when preceded by 6+ chars to avoid short phrases)
    text = re.sub(r'(\w{6,})\s+(und|oder)\s+(\w{4,})', r'\1, \2 \3', text)

    # ── 5. Interjection pauses ──
    # Common German interjections get a micro-pause after them
    interjections = (
        'Ach|Oh|Ah|Ooh|Wow|Hey|Hm|Hmm|Na|Naja|Tja|Aha|Ohje|Hoppla|'
        'Hurra|Ups|Autsch|Aua|Igitt|Pfui|Juhu|Oje|Mensch|Mist|Donnerwetter'
    )
    text = re.sub(r'\b(' + interjections + r')([,!]?\s)', r'\1, ... ', text)

    # ── 6. Number pronunciation ──
    text = re.sub(r'\b(\d+)\b', lambda m: number_to_german(int(m.group(1))), text)

    # ── 7. Onomatopoeia emphasis: stretch sound words for kids ──
    sound_words = {
        'Platsch': 'Plaatsch', 'platsch': 'plaatsch',
        'Bumm': 'Buumm', 'bumm': 'buumm',
        'Puff': 'Puuff', 'puff': 'puuff',
        'Knall': 'Knaall', 'knall': 'knaall',
        'Zisch': 'Ziisch', 'zisch': 'ziisch',
        'Klopf': 'Kloopf', 'klopf': 'kloopf',
        'Plopp': 'Ploopp', 'plopp': 'ploopp',
        'Krach': 'Kraach', 'krach': 'kraach',
        'Huiii': 'Huuiii',
        'Pssst': 'Psssst',
        'Huch': 'Huuch', 'huch': 'huuch',
        'Wusch': 'Wuusch', 'wusch': 'wuusch',
        'Schwupp': 'Schwuupp', 'schwupp': 'schwuupp',
        'Rums': 'Ruums', 'rums': 'ruums',
        'Piep': 'Pieep', 'piep': 'pieep',
        'Miau': 'Miaauu', 'miau': 'miaauu',
        'Wuff': 'Wuuff', 'wuff': 'wuuff',
        'Brumm': 'Bruumm', 'brumm': 'bruumm',
        'Ratsch': 'Raatsch', 'ratsch': 'raatsch',
        'Klirr': 'Kliirr', 'klirr': 'kliirr',
        'Kling': 'Kliing', 'kling': 'kliing',
        'Dong': 'Doong', 'dong': 'doong',
        'Tock': 'Toock', 'tock': 'toock',
        'Tick': 'Tiick', 'tick': 'tiick',
    }
    for word, replacement in sound_words.items():
        text = re.sub(r'\b' + re.escape(word) + r'\b', replacement, text)

    # ── 8. Trailing ellipsis for suspense sentences ──
    # "Er öffnete die Tür." at end of paragraph → add slight suspense if followed by paragraph break
    text = re.sub(r'([.])(\n\n)', r'\1 …\2', text)

    # ── 9. Emphasis via repetition: stretch emphasized words ──
    # Words in ALL CAPS get slightly stretched for emphasis
    def stretch_caps(m):
        word = m.group(0)
        if len(word) < 3 or word in ('ICH', 'DU', 'ER', 'SIE', 'WIR', 'IHR', 'DAS', 'DIE', 'DER', 'UND', 'MIT'):
            return word.capitalize()
        return word.capitalize()
    text = re.sub(r'\b[A-ZÄÖÜ]{3,}\b', stretch_caps, text)

    # ── 10. Direct address pauses: "Komm, Leo, wir gehen" ──
    # Add micro-pause around names in direct address
    text = re.sub(r',\s*([A-ZÄÖÜ][a-zäöüß]+)\s*,', r', \1, ', text)

    # ── 11. Clean up artifacts ──
    text = re.sub(r',\s*,', ',', text)
    text = re.sub(r'\.\s*,', '.', text)
    text = re.sub(r',\s*\.', '.', text)
    text = re.sub(r'\.{4,}', '\u2026', text)   # normalize 4+ dots to ellipsis
    text = re.sub(r'\.{3}', '\u2026', text)     # triple dots to ellipsis
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r' *\n *', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'\s+([.!?,…])', r'\1', text)  # no space before punctuation

    return text.strip()

def number_to_german(n):
    """Convert small numbers to German words for natural TTS reading."""
    if n < 0 or n > 9999:
        return str(n)
    words = {
        0: 'null', 1: 'eins', 2: 'zwei', 3: 'drei', 4: 'vier',
        5: 'fünf', 6: 'sechs', 7: 'sieben', 8: 'acht', 9: 'neun',
        10: 'zehn', 11: 'elf', 12: 'zwölf', 13: 'dreizehn', 14: 'vierzehn',
        15: 'fünfzehn', 16: 'sechzehn', 17: 'siebzehn', 18: 'achtzehn',
        19: 'neunzehn', 20: 'zwanzig', 30: 'dreißig', 40: 'vierzig',
        50: 'fünfzig', 60: 'sechzig', 70: 'siebzig', 80: 'achtzig',
        90: 'neunzig', 100: 'hundert',
    }
    if n in words:
        return words[n]
    if n < 100:
        tens = (n // 10) * 10
        ones = n % 10
        if ones == 0:
            return words.get(tens, str(n))
        if ones == 1:
            return f'einund{words[tens]}'
        return f'{words.get(ones, str(ones))}und{words.get(tens, str(tens))}'
    if n < 1000:
        hundreds = n // 100
        rest = n % 100
        prefix = words.get(hundreds, str(hundreds)) + 'hundert'
        if rest == 0:
            return prefix
        return prefix + number_to_german(rest)
    if n < 10000:
        thousands = n // 1000
        rest = n % 1000
        prefix = words.get(thousands, str(thousands)) + 'tausend'
        if rest == 0:
            return prefix
        return prefix + number_to_german(rest)
    return str(n)

def generate_silence(duration_ms, sample_rate=22050, bits_per_sample=16, num_channels=1):
    """Generate a WAV chunk of silence."""
    num_samples = int(sample_rate * duration_ms / 1000)
    byte_rate = sample_rate * num_channels * (bits_per_sample // 8)
    block_align = num_channels * (bits_per_sample // 8)
    data_size = num_samples * block_align
    silence = b'\x00' * data_size
    header = struct.pack('<4sI4s', b'RIFF', 36 + data_size, b'WAVE')
    fmt_chunk = struct.pack('<4sIHHIIHH', b'fmt ', 16, 1, num_channels,
                           sample_rate, byte_rate, block_align, bits_per_sample)
    data_header = struct.pack('<4sI', b'data', data_size)
    return header + fmt_chunk + data_header + silence

def split_text_into_chunks(text, max_chars=MAX_CHUNK_CHARS):
    """
    Split text into chunks optimized for Piper TTS.
    - Keeps sentence boundaries so punctuation can become audible pauses.
    - Splits overlong sentences without breaking words.
    - Separates dialogue/narration transitions for better expressiveness.
    """
    paragraphs = text.split('\n\n')
    chunks = []

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        sentences = _split_sentences_preserve_quotes(para)
        normalized_sentences = []
        for sentence in sentences:
            if not sentence or not sentence.strip():
                continue
            normalized_sentences.extend(_split_overlong_sentence(sentence, max_chars))

        current_chunk = ''
        current_sentence_count = 0
        current_has_dialogue = False

        for sentence in normalized_sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            has_dialogue = '"' in sentence
            if not current_chunk:
                current_chunk = sentence
                current_sentence_count = 1
                current_has_dialogue = has_dialogue
                continue

            would_exceed = len(current_chunk) + len(sentence) + 1 > max_chars
            sentence_limit_hit = current_sentence_count >= max(1, MAX_SENTENCES_PER_CHUNK)
            dialogue_boundary = has_dialogue != current_has_dialogue and len(current_chunk) > 40

            if would_exceed or sentence_limit_hit or dialogue_boundary:
                chunks.append(current_chunk.strip())
                current_chunk = sentence
                current_sentence_count = 1
                current_has_dialogue = has_dialogue
            else:
                current_chunk = (current_chunk + ' ' + sentence).strip()
                current_sentence_count += 1
                current_has_dialogue = current_has_dialogue or has_dialogue

        if current_chunk:
            chunks.append(current_chunk.strip())

    return chunks


def generate_wav_chunk(text, length_scale=1.0, noise_scale=0.667, noise_w=0.8,
                       model_path=None, speaker_id=None):
    """Generate WAV audio for a single text chunk using Piper.
    model_path: override model (e.g. emotional model for dialogue).
    speaker_id: speaker index for multi-speaker models (emotional model).
    """
    cmd = [
        PIPER_BINARY,
        "--model", model_path or MODEL_PATH,
        "--output_file", "-",
        "--length_scale", str(length_scale),
        "--noise_scale", str(noise_scale),
        "--noise_w", str(noise_w),
    ]
    if speaker_id is not None:
        cmd.extend(["--speaker", str(speaker_id)])

    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    stdout, stderr = proc.communicate(input=text.encode('utf-8'))

    if proc.returncode != 0:
        error_msg = stderr.decode('utf-8')
        raise RuntimeError(f"Piper error: {error_msg}")

    return stdout

def concatenate_wav(wav_chunks):
    """Concatenate multiple WAV byte arrays into a single WAV file."""
    if len(wav_chunks) == 1:
        return wav_chunks[0]

    all_audio_data = []
    sample_rate = None
    num_channels = None
    bits_per_sample = None

    for wav_bytes in wav_chunks:
        if len(wav_bytes) < 44:
            continue

        # Parse WAV header (44 bytes for standard PCM WAV)
        # Bytes 22-23: num channels
        # Bytes 24-27: sample rate
        # Bytes 34-35: bits per sample
        # Bytes 36-39: "data"
        # Bytes 40-43: data size
        channels = struct.unpack_from('<H', wav_bytes, 22)[0]
        rate = struct.unpack_from('<I', wav_bytes, 24)[0]
        bps = struct.unpack_from('<H', wav_bytes, 34)[0]

        if sample_rate is None:
            sample_rate = rate
            num_channels = channels
            bits_per_sample = bps

        # Find the data chunk - search for "data" marker
        data_offset = wav_bytes.find(b'data')
        if data_offset == -1:
            continue
        data_size = struct.unpack_from('<I', wav_bytes, data_offset + 4)[0]
        audio_start = data_offset + 8
        all_audio_data.append(wav_bytes[audio_start:audio_start + data_size])

    if not all_audio_data:
        return wav_chunks[0] if wav_chunks else b''

    # Combine all audio data
    combined_data = b''.join(all_audio_data)
    total_data_size = len(combined_data)

    # Build new WAV file
    byte_rate = sample_rate * num_channels * (bits_per_sample // 8)
    block_align = num_channels * (bits_per_sample // 8)

    header = struct.pack('<4sI4s', b'RIFF', 36 + total_data_size, b'WAVE')
    fmt_chunk = struct.pack('<4sIHHIIHH', b'fmt ', 16, 1, num_channels,
                           sample_rate, byte_rate, block_align, bits_per_sample)
    data_header = struct.pack('<4sI', b'data', total_data_size)

    return header + fmt_chunk + data_header + combined_data

def _postprocess_with_ffmpeg(wav_bytes):
    """Apply broadcast-quality post-processing via FFmpeg.
    Includes high-pass filter, dynamic compression, and limiter."""
    if not ENABLE_FFMPEG_POSTPROCESS:
        return None  # Signal caller to use fallback

    try:
        cmd = [
            'ffmpeg', '-y',
            '-i', 'pipe:0',
            '-af', FFMPEG_FILTER_CHAIN,
            '-ar', '22050',         # Preserve sample rate
            '-ac', '1',             # Mono
            '-acodec', 'pcm_s16le', # 16-bit PCM
            '-f', 'wav',
            'pipe:1'
        ]
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        stdout, stderr = proc.communicate(input=wav_bytes, timeout=30)

        if proc.returncode != 0:
            print(f"FFmpeg post-processing failed (rc={proc.returncode}): {stderr.decode('utf-8', errors='replace')[:200]}", file=sys.stderr)
            return None

        if len(stdout) < 44:
            print("FFmpeg returned too little data, falling back", file=sys.stderr)
            return None

        return stdout
    except FileNotFoundError:
        print("FFmpeg not found, falling back to basic normalization", file=sys.stderr)
        return None
    except subprocess.TimeoutExpired:
        proc.kill()
        print("FFmpeg timed out, falling back to basic normalization", file=sys.stderr)
        return None
    except Exception as e:
        print(f"FFmpeg error: {e}, falling back to basic normalization", file=sys.stderr)
        return None


def _postprocess_output_wav(wav_bytes):
    """Post-process audio: try FFmpeg first, fall back to basic normalization."""
    # Try FFmpeg for broadcast-quality processing
    ffmpeg_result = _postprocess_with_ffmpeg(wav_bytes)
    if ffmpeg_result is not None:
        return ffmpeg_result

    # Fallback: basic peak normalization + edge fade
    if not ENABLE_OUTPUT_NORMALIZATION:
        return wav_bytes
    if len(wav_bytes) < 44:
        return wav_bytes

    data_offset = wav_bytes.find(b'data')
    if data_offset == -1 or data_offset + 8 > len(wav_bytes):
        return wav_bytes

    data_size = struct.unpack_from('<I', wav_bytes, data_offset + 4)[0]
    audio_start = data_offset + 8
    audio_end = audio_start + data_size
    if audio_end > len(wav_bytes):
        return wav_bytes

    pcm = bytearray(wav_bytes[audio_start:audio_end])
    sample_count = len(pcm) // 2
    if sample_count <= 0:
        return wav_bytes

    max_abs = 0
    for i in range(0, len(pcm), 2):
        value = struct.unpack_from('<h', pcm, i)[0]
        abs_value = abs(value)
        if abs_value > max_abs:
            max_abs = abs_value

    if max_abs == 0:
        return wav_bytes

    target_peak = _clamp(OUTPUT_TARGET_PEAK, 0.10, 0.99)
    target_amplitude = int(32767 * target_peak)
    gain = target_amplitude / max_abs
    gain = _clamp(gain, 0.60, 2.50)

    sample_rate = 22050
    if len(wav_bytes) >= 28:
        sample_rate = struct.unpack_from('<I', wav_bytes, 24)[0]

    fade_samples = int(max(0, OUTPUT_EDGE_FADE_MS) * sample_rate / 1000)
    fade_samples = min(fade_samples, sample_count // 2)

    for sample_index in range(sample_count):
        raw_value = struct.unpack_from('<h', pcm, sample_index * 2)[0]
        scaled = int(raw_value * gain)

        if fade_samples > 0:
            if sample_index < fade_samples:
                scaled = int(scaled * (sample_index / fade_samples))
            elif sample_index >= (sample_count - fade_samples):
                tail_pos = sample_count - sample_index - 1
                scaled = int(scaled * (tail_pos / fade_samples))

        scaled = max(-32768, min(32767, scaled))
        struct.pack_into('<h', pcm, sample_index * 2, scaled)

    return wav_bytes[:audio_start] + bytes(pcm) + wav_bytes[audio_end:]

def _get_silence_between(chunk_a, chunk_b):
    """Determine silence duration between two chunks based on content."""
    has_dialogue_a = '"' in chunk_a
    has_dialogue_b = '"' in chunk_b

    tail = chunk_a.rstrip()
    while tail and tail[-1] in '"\'':
        tail = tail[:-1]

    # Scene/paragraph boundary: longer pause
    if tail.endswith('...') or tail.endswith('\u2026'):
        return generate_silence(SILENCE_SCENE_MS)

    # Dialogue transition
    if has_dialogue_a != has_dialogue_b:
        return generate_silence(SILENCE_DIALOGUE_MS)

    # Sentence punctuation
    if tail.endswith('!!') or tail.endswith('!'):
        return generate_silence(SILENCE_EXCLAIM_MS)
    if tail.endswith('??') or tail.endswith('?'):
        return generate_silence(SILENCE_QUESTION_MS)
    if tail.endswith('.'):
        return generate_silence(SILENCE_PERIOD_MS)
    if tail.endswith(',') or tail.endswith(':') or tail.endswith(';'):
        return generate_silence(SILENCE_COMMA_MS)

    # Default fallback
    return generate_silence(SILENCE_DEFAULT_MS)


def _do_generate(text, length_scale, noise_scale, noise_w):
    """Core generation logic — called synchronously or in a job thread."""
    text = preprocess_text(text)
    text = prepare_for_tts(text)
    text = _enhance_story_text_for_tts(text)
    text = _apply_custom_pronunciations(text)

    chunks = split_text_into_chunks(text)
    print(f"Split into {len(chunks)} chunks", file=sys.stderr)

    # Derive per-chunk prosody + model selection, then smooth transitions.
    chunk_params = []
    prev_length = _clamp(length_scale, MIN_LENGTH_SCALE, MAX_LENGTH_SCALE)
    prev_noise = _clamp(noise_scale, MIN_NOISE_SCALE, MAX_NOISE_SCALE)
    prev_noise_w = _clamp(noise_w, MIN_NOISE_W, MAX_NOISE_W)

    for chunk in chunks:
        target_length, target_noise, target_noise_w = _derive_chunk_params(
            chunk, length_scale, noise_scale, noise_w
        )
        model_path, speaker_id = _select_model_for_chunk(chunk)

        if ENABLE_PROSODY_SMOOTHING and chunk_params:
            smoothed_length = _clamp_step(prev_length, target_length, MAX_LENGTH_SCALE_STEP)
            smoothed_noise = _clamp_step(prev_noise, target_noise, MAX_NOISE_SCALE_STEP)
            smoothed_noise_w = _clamp_step(prev_noise_w, target_noise_w, MAX_NOISE_W_STEP)
        else:
            smoothed_length = target_length
            smoothed_noise = target_noise
            smoothed_noise_w = target_noise_w

        smoothed_length = _clamp(smoothed_length, MIN_LENGTH_SCALE, MAX_LENGTH_SCALE)
        smoothed_noise = _clamp(smoothed_noise, MIN_NOISE_SCALE, MAX_NOISE_SCALE)
        smoothed_noise_w = _clamp(smoothed_noise_w, MIN_NOISE_W, MAX_NOISE_W)

        chunk_params.append((smoothed_length, smoothed_noise, smoothed_noise_w, model_path, speaker_id))
        prev_length, prev_noise, prev_noise_w = smoothed_length, smoothed_noise, smoothed_noise_w

    wav_results = [None] * len(chunks)
    workers = min(MAX_PARALLEL_PIPER, len(chunks))

    if workers <= 1:
        for idx in range(len(chunks)):
            chunk_length, chunk_noise, chunk_noise_w, m_path, s_id = chunk_params[idx]
            if DEBUG_TTS_PROSODY:
                model_label = "emotional" if m_path != MODEL_PATH else "high"
                print(
                    f"  Prosody chunk {idx+1}/{len(chunks)}: len_scale={chunk_length:.3f}, noise={chunk_noise:.3f}, noise_w={chunk_noise_w:.3f}, model={model_label}, speaker={s_id}",
                    file=sys.stderr,
                )
            wav_results[idx] = generate_wav_chunk(chunks[idx], chunk_length, chunk_noise, chunk_noise_w, m_path, s_id)
    else:
        def gen_chunk(idx):
            cs = time.time()
            chunk_length, chunk_noise, chunk_noise_w, m_path, s_id = chunk_params[idx]
            if DEBUG_TTS_PROSODY:
                model_label = "emotional" if m_path != MODEL_PATH else "high"
                print(
                    f"  Prosody chunk {idx+1}/{len(chunks)}: len_scale={chunk_length:.3f}, noise={chunk_noise:.3f}, noise_w={chunk_noise_w:.3f}, model={model_label}, speaker={s_id}",
                    file=sys.stderr,
                )
            data = generate_wav_chunk(chunks[idx], chunk_length, chunk_noise, chunk_noise_w, m_path, s_id)
            ct = time.time() - cs
            print(f"  Chunk {idx+1}/{len(chunks)}: {len(chunks[idx])} chars -> {len(data)} bytes ({ct:.1f}s)", file=sys.stderr)
            return idx, data

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(gen_chunk, i) for i in range(len(chunks))]
            for future in as_completed(futures):
                idx, data = future.result()
                wav_results[idx] = data

    wav_chunks = []
    for i, wav_data in enumerate(wav_results):
        wav_chunks.append(wav_data)
        if i < len(wav_results) - 1:
            silence = _get_silence_between(chunks[i], chunks[i + 1])
            wav_chunks.append(silence)

    return _postprocess_output_wav(concatenate_wav(wav_chunks))

def _purge_old_jobs():
    """Remove jobs older than JOB_TTL_SECONDS."""
    now = time.time()
    with _jobs_lock:
        expired = [jid for jid, j in _jobs.items() if now - j['created'] > JOB_TTL_SECONDS]
        for jid in expired:
            del _jobs[jid]
    if expired:
        print(f"Purged {len(expired)} expired jobs", file=sys.stderr)

@app.route('/health', methods=['GET'])
def health():
    return "ok", 200

# ── Async job endpoints ───────────────────────────────────────────────────────

@app.route('/generate/async', methods=['POST'])
def generate_async():
    """
    Submit a TTS generation job. Returns immediately with a job_id.
    The actual generation runs in the background.

    Request: { "text": "...", "length_scale": 1.55, "noise_scale": 0.42, "noise_w": 0.38 }
    Response: { "job_id": "uuid" }
    """
    if not request.is_json:
        return "JSON body required", 400

    data = request.json
    text = data.get('text', '')
    if not text:
        return "No text provided", 400

    length_scale = _to_float(data.get('length_scale'), DEFAULT_LENGTH_SCALE)
    noise_scale = _to_float(data.get('noise_scale'), DEFAULT_NOISE_SCALE)
    noise_w = _to_float(data.get('noise_w'), DEFAULT_NOISE_W)

    _purge_old_jobs()

    job_id = str(uuid.uuid4())
    with _jobs_lock:
        _jobs[job_id] = {
            'status': 'processing',
            'result': None,
            'error': None,
            'created': time.time(),
        }

    print(f"Job {job_id}: queued (text len={len(text)})", file=sys.stderr)

    def run_job():
        start = time.time()
        try:
            result = _do_generate(text, length_scale, noise_scale, noise_w)
            elapsed = time.time() - start
            print(f"Job {job_id}: ready ({len(result)} bytes, {elapsed:.1f}s)", file=sys.stderr)
            with _jobs_lock:
                if job_id in _jobs:
                    _jobs[job_id]['status'] = 'ready'
                    _jobs[job_id]['result'] = result
        except Exception as e:
            elapsed = time.time() - start
            print(f"Job {job_id}: error after {elapsed:.1f}s: {e}", file=sys.stderr)
            with _jobs_lock:
                if job_id in _jobs:
                    _jobs[job_id]['status'] = 'error'
                    _jobs[job_id]['error'] = str(e)

    _job_executor.submit(run_job)

    return jsonify({'job_id': job_id}), 202


@app.route('/generate/status/<job_id>', methods=['GET'])
def generate_status(job_id):
    """
    Poll job status.
    Response: { "status": "processing" | "ready" | "error", "error": null | "message" }
    """
    with _jobs_lock:
        job = _jobs.get(job_id)

    if job is None:
        return jsonify({'status': 'not_found'}), 404

    return jsonify({
        'status': job['status'],
        'error': job.get('error'),
    }), 200


@app.route('/generate/result/<job_id>', methods=['GET'])
def generate_result(job_id):
    """
    Fetch completed job result as WAV audio.
    Returns 202 if still processing, 200 with audio/wav if ready, 500 if error.
    """
    with _jobs_lock:
        job = _jobs.get(job_id)

    if job is None:
        return jsonify({'error': 'job not found'}), 404

    if job['status'] == 'processing':
        return jsonify({'status': 'processing'}), 202

    if job['status'] == 'error':
        return jsonify({'error': job.get('error', 'unknown error')}), 500

    # Ready — serve audio and clean up job
    result_bytes = job['result']
    with _jobs_lock:
        _jobs.pop(job_id, None)

    return send_file(
        io.BytesIO(result_bytes),
        mimetype="audio/wav",
        as_attachment=False,
        download_name="tts.wav"
    )

# ── Legacy synchronous endpoints (kept for backward compatibility) ─────────────

@app.route('/', methods=['GET', 'POST'])
def generate_tts():
    # Support both GET (query param) and POST (json or form)
    text = None
    length_scale = DEFAULT_LENGTH_SCALE
    noise_scale = DEFAULT_NOISE_SCALE
    noise_w = DEFAULT_NOISE_W

    if request.method == 'POST':
        if request.is_json:
            data = request.json
            text = data.get('text')
            length_scale = _to_float(data.get('length_scale'), DEFAULT_LENGTH_SCALE)
            noise_scale = _to_float(data.get('noise_scale'), DEFAULT_NOISE_SCALE)
            noise_w = _to_float(data.get('noise_w'), DEFAULT_NOISE_W)
        else:
            text = request.form.get('text')
            # form handling for params if needed, but JSON is main use case
            if request.form.get('length_scale'):
                length_scale = _to_float(request.form.get('length_scale'), DEFAULT_LENGTH_SCALE)
            if request.form.get('noise_scale'):
                noise_scale = _to_float(request.form.get('noise_scale'), DEFAULT_NOISE_SCALE)
            if request.form.get('noise_w'):
                noise_w = _to_float(request.form.get('noise_w'), DEFAULT_NOISE_W)

    if not text:
        text = request.args.get('text')
        # query params also possible
        if request.args.get('length_scale'):
            length_scale = _to_float(request.args.get('length_scale'), DEFAULT_LENGTH_SCALE)
        if request.args.get('noise_scale'):
            noise_scale = _to_float(request.args.get('noise_scale'), DEFAULT_NOISE_SCALE)
        if request.args.get('noise_w'):
            noise_w = _to_float(request.args.get('noise_w'), DEFAULT_NOISE_W)

    if not text:
        print("Error: No text provided in request", file=sys.stderr)
        return "No text provided", 400

    print(f"Sync request: len={len(text)}, speed={length_scale}, noise={noise_scale}, noise_w={noise_w}", file=sys.stderr)
    start_time = time.time()

    try:
        result = _do_generate(text, length_scale, noise_scale, noise_w)
        total_time = time.time() - start_time
        print(f"Successfully generated audio. Size: {len(result)} bytes, Total time: {total_time:.1f}s", file=sys.stderr)

        return send_file(
            io.BytesIO(result),
            mimetype="audio/wav",
            as_attachment=False,
            download_name="tts.wav"
        )

    except Exception as e:
        print(f"Server exception: {e}", file=sys.stderr)
        return str(e), 500

@app.route('/batch', methods=['POST'])
def generate_tts_batch():
    """
    Batch endpoint: generate multiple TTS items in parallel.
    Request: { "items": [{ "id": "chunk-1", "text": "..." }, ...], "length_scale": 1.55, ... }
    Response: { "results": [{ "id": "chunk-1", "audio": "base64...", "error": null }, ...] }
    """
    if not request.is_json:
        return "JSON body required", 400

    data = request.json
    items = data.get('items', [])
    if not items:
        return jsonify({"results": []}), 200

    length_scale = _to_float(data.get('length_scale'), DEFAULT_LENGTH_SCALE)
    noise_scale = _to_float(data.get('noise_scale'), DEFAULT_NOISE_SCALE)
    noise_w = _to_float(data.get('noise_w'), DEFAULT_NOISE_W)

    print(f"Batch request: {len(items)} items, speed={length_scale}", file=sys.stderr)
    start_time = time.time()

    def process_item(item):
        item_id = item.get('id', 'unknown')
        text = item.get('text', '')
        if not text:
            return {"id": item_id, "audio": None, "error": "No text"}
        try:
            text = preprocess_text(text)
            text = prepare_for_tts(text)
            text = _enhance_story_text_for_tts(text)
            text = _apply_custom_pronunciations(text)
            chunks = split_text_into_chunks(text)

            wav_chunks = []
            for i, chunk in enumerate(chunks):
                chunk_length, chunk_noise, chunk_noise_w = _derive_chunk_params(
                    chunk, length_scale, noise_scale, noise_w
                )
                m_path, s_id = _select_model_for_chunk(chunk)
                wav_data = generate_wav_chunk(chunk, chunk_length, chunk_noise, chunk_noise_w, m_path, s_id)
                wav_chunks.append(wav_data)
                if i < len(chunks) - 1:
                    wav_chunks.append(_get_silence_between(chunks[i], chunks[i + 1]))

            result_wav = _postprocess_output_wav(concatenate_wav(wav_chunks))
            audio_b64 = base64.b64encode(result_wav).decode('ascii')
            return {"id": item_id, "audio": f"data:audio/wav;base64,{audio_b64}", "error": None}
        except Exception as e:
            print(f"Batch item {item_id} error: {e}", file=sys.stderr)
            return {"id": item_id, "audio": None, "error": str(e)}

    # Process all items in parallel
    workers = min(MAX_PARALLEL_PIPER, len(items))
    results = [None] * len(items)

    if workers <= 1:
        for i in range(len(items)):
            results[i] = process_item(items[i])
    else:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(process_item, items[i]): i for i in range(len(items))}
            for future in as_completed(futures):
                idx = futures[future]
                results[idx] = future.result()

    total_time = time.time() - start_time
    ok_count = sum(1 for r in results if r and r.get('audio'))
    print(f"Batch done: {ok_count}/{len(items)} ok, {total_time:.1f}s ({workers} workers)", file=sys.stderr)

    return jsonify({"results": results}), 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting TTS Server on port {port}...", file=sys.stderr)
    app.run(host='0.0.0.0', port=port)
