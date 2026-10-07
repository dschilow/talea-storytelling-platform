"""Lautstärkekurven der Sprach-Clips für die Mundbewegung (Lippen-Synchronisation).

Liest frontend/public/game/alibi/voices/*.mp3 (nur Sprache, keine fx./amb.-Klänge), misst die Lautheit in 50-ms-Fenstern
(20 Bilder pro Sekunde) und schreibt lips.json: {"fps": 20, "d": {"kom.cast.start": "0136875420…", …}}.
Jede Ziffer ist die Mundöffnung 0–9 in diesem Fenster, je Clip auf seine laute Stelle normiert.

    python scripts/game-voices/envelopes.py
"""
import json
import pathlib
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
VOICES = ROOT / "frontend/public/game/alibi/voices"
FPS = 20
SR = 8000


def envelope(path: pathlib.Path) -> str:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
        capture_output=True,
        check=True,
    ).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    hop = SR // FPS
    n = max(1, len(x) // hop)
    frames = x[: n * hop].reshape(n, hop)
    rms = np.sqrt((frames**2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    top = np.percentile(db, 95)
    # Mund zu unterhalb von ~ -30 dB unter der lauten Stelle, ganz offen an der lauten Stelle
    lvl = np.clip((db - (top - 30)) / 30, 0, 1)
    # leichte Glättung: Mund öffnet schnell, schließt etwas langsamer
    out = np.zeros_like(lvl)
    cur = 0.0
    for i, v in enumerate(lvl):
        cur = v if v > cur else cur * 0.55 + v * 0.45
        out[i] = cur
    return "".join(str(int(round(v * 9))) for v in out)


def main() -> int:
    files = sorted(p for p in VOICES.glob("*.mp3") if not p.stem.startswith(("fx.", "amb.")))
    if not files:
        print("Keine Sprach-Clips gefunden.")
        return 1
    with ThreadPoolExecutor(max_workers=8) as ex:
        envs = list(ex.map(envelope, files))
    data = {"fps": FPS, "d": {p.stem: e for p, e in zip(files, envs)}}
    out = VOICES / "lips.json"
    out.write_text(json.dumps(data, separators=(",", ":")), encoding="utf8")
    total = sum(len(e) for e in envs)
    print(f"{len(files)} Clips, {total / FPS / 60:.1f} min, {out.stat().st_size / 1024:.0f} KB -> {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
