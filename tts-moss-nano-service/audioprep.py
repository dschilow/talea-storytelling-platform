"""Audio post-processing shared by the Thorsten-Voice services (Kokoro, CosyVoice3).

Sentence assembly with fixed pauses, silence trimming and EBU R128 loudness normalisation.
Both services read the same environment variables, so their output is directly comparable.
"""
import json
import logging
import math
import os
import subprocess
from io import BytesIO
from typing import Callable, Iterable, Optional

import numpy as np
import soundfile as sf

from textprep import Pauses, Segment

log = logging.getLogger("audioprep")


def env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


LEAD_IN_S = env_float("LEAD_IN_S", 0.1)
MP3_BITRATE = os.environ.get("MP3_BITRATE", "128k")
LOUDNORM = os.environ.get("LOUDNORM", "1").strip() != "0"
TARGET_LUFS = env_float("TARGET_LUFS", -16.0)
TRUE_PEAK_DB = env_float("TRUE_PEAK_DB", -1.5)
HIGHPASS_HZ = int(env_float("HIGHPASS_HZ", 60))
OUTPUT_GAIN_DB = env_float("OUTPUT_GAIN_DB", 4)  # fallback when loudness normalisation is off or fails


def pauses_from_env() -> Pauses:
    return Pauses(
        clause=env_float("CLAUSE_PAUSE_S", 0.15),
        colon=env_float("COLON_PAUSE_S", 0.35),
        sentence=env_float("SENTENCE_PAUSE_S", 0.45),
        exclamation=env_float("EXCLAMATION_PAUSE_S", 0.5),
        question=env_float("QUESTION_PAUSE_S", 0.55),
        ellipsis=env_float("ELLIPSIS_PAUSE_S", 0.8),
        paragraph=env_float("PARAGRAPH_PAUSE_S", 1.0),
        end=env_float("END_PAUSE_S", 0.8),
    )


def silence(seconds: float, sample_rate: int) -> np.ndarray:
    return np.zeros(max(0, int(sample_rate * seconds)), dtype=np.float32)


def trim_silence(samples: np.ndarray, sample_rate: int, threshold_db: float = -45.0) -> np.ndarray:
    """Cut the model's variable lead/tail silence so the inserted pauses alone set the rhythm."""
    frame = int(sample_rate * 0.01)
    frames = samples.size // frame
    peak = float(np.max(np.abs(samples))) if samples.size else 0.0
    if frames == 0 or peak <= 0.0:
        return samples
    rms = np.sqrt(np.mean(samples[: frames * frame].reshape(frames, frame) ** 2, axis=1))
    active = np.nonzero(rms > peak * 10 ** (threshold_db / 20.0))[0]
    if active.size == 0:
        return samples
    start = max(0, active[0] * frame - int(sample_rate * 0.03))
    end = min(samples.size, (active[-1] + 1) * frame + int(sample_rate * 0.08))  # keep the natural decay
    return samples[start:end]


def fade(samples: np.ndarray, sample_rate: int, seconds: float = 0.008) -> np.ndarray:
    n = min(int(sample_rate * seconds), samples.size // 2)
    if n <= 0:
        return samples
    ramp = np.linspace(0.0, 1.0, n, dtype=np.float32)
    out = samples.copy()
    out[:n] *= ramp
    out[-n:] *= ramp[::-1]
    return out


def assemble(
    segments: Iterable[Segment],
    render: Callable[[str], Optional[np.ndarray]],
    sample_rate: int,
) -> np.ndarray:
    """Render every segment, trim it and join everything with the segment's pause."""
    pieces = [silence(LEAD_IN_S, sample_rate)]
    rendered = 0
    for segment in segments:
        audio = render(segment.text)
        if audio is None or audio.size == 0:
            log.warning("No audio for segment: %r", segment.text[:80])
            continue
        pieces.append(fade(trim_silence(audio, sample_rate), sample_rate))
        pieces.append(silence(segment.pause, sample_rate))
        rendered += 1
    if not rendered:
        raise RuntimeError("Model produced no audio.")
    return np.concatenate(pieces)


def _run_ffmpeg(samples: np.ndarray, sample_rate: int, args: list) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(sample_rate), "-ac", "1", "-i", "pipe:0", *args],
        input=samples.astype(np.float32).tobytes(),
        capture_output=True,
        timeout=180,
    )


def _prefilter() -> str:
    return f"highpass=f={HIGHPASS_HZ}" if HIGHPASS_HZ > 0 else "anull"


def _loudnorm_chain(samples: np.ndarray, sample_rate: int) -> Optional[str]:
    """Two-pass EBU R128 normalisation as one linear gain, so every chunk plays equally loud."""
    target = f"I={TARGET_LUFS}:TP={TRUE_PEAK_DB}:LRA=20"
    proc = _run_ffmpeg(samples, sample_rate, ["-af", f"{_prefilter()},loudnorm={target}:print_format=json", "-f", "null", "-"])
    stderr = proc.stderr.decode(errors="ignore")
    start, end = stderr.rfind("{"), stderr.rfind("}")
    if proc.returncode != 0 or start < 0 or end < start:
        log.warning("loudnorm measurement failed: %s", stderr[-300:])
        return None
    try:
        measured = json.loads(stderr[start:end + 1])
        values = {key: float(measured[key]) for key in ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset")}
    except (KeyError, ValueError):
        log.warning("loudnorm measurement unreadable: %s", stderr[start:end + 1][:300])
        return None
    if not all(math.isfinite(v) for v in values.values()):
        return None  # e.g. clips too short to measure
    return (
        f"{_prefilter()},loudnorm={target}:measured_I={values['input_i']}:measured_TP={values['input_tp']}"
        f":measured_LRA={values['input_lra']}:measured_thresh={values['input_thresh']}"
        f":offset={values['target_offset']}:linear=true,aresample={sample_rate}"
    )


def _fixed_gain(samples: np.ndarray) -> np.ndarray:
    gain = 10 ** (OUTPUT_GAIN_DB / 20.0)
    peak = float(np.max(np.abs(samples))) if samples.size else 0.0
    if peak * gain > 0.97:  # never clip
        gain = 0.97 / peak
    return np.clip(samples * gain, -1.0, 1.0).astype(np.float32)


def encode(samples: np.ndarray, fmt: str, sample_rate: int) -> bytes:
    chain = _loudnorm_chain(samples, sample_rate) if LOUDNORM else None
    if chain is None:
        samples, chain = _fixed_gain(samples), _prefilter()

    if fmt == "wav":
        args = ["-af", chain, "-ar", str(sample_rate), "-f", "s16le", "-acodec", "pcm_s16le", "pipe:1"]
    else:
        args = ["-af", chain, "-ar", str(sample_rate), "-codec:a", "libmp3lame", "-b:a", MP3_BITRATE, "-f", "mp3", "pipe:1"]
    proc = _run_ffmpeg(samples, sample_rate, args)
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError(f"ffmpeg {fmt} encoding failed: {proc.stderr.decode(errors='ignore')[-300:]}")
    if fmt != "wav":
        return proc.stdout
    buf = BytesIO()
    sf.write(buf, np.frombuffer(proc.stdout, dtype=np.int16), sample_rate, format="WAV", subtype="PCM_16")
    return buf.getvalue()
