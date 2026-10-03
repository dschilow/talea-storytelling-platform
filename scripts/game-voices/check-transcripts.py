"""Hört die erzeugten Clips lokal ab (faster-whisper) und vergleicht das Gesprochene mit dem Sollttext.

Findet: gesprochene Audio-Tags, fehlende oder doppelte Sätze, abgeschnittene Clips.
Einrichtung (einmalig):  python -m venv .venv-whisper && .venv-whisper/Scripts/pip install faster-whisper
Aufruf:                  .venv-whisper/Scripts/python scripts/game-voices/check-transcripts.py [--only teilstring] [--model small]
Ergebnis:                scripts/game-voices/.cache/transcripts.json (Rangliste der schlechtesten Treffer wird ausgegeben)
"""
import difflib
import json
import re
import sys
from pathlib import Path

from faster_whisper import WhisperModel

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "frontend" / "public" / "game" / "alibi" / "voices"
LEDGER = json.loads((HERE / ".cache" / "ledger.json").read_text(encoding="utf-8"))
RESULT = HERE / ".cache" / "transcripts.json"

args = sys.argv[1:]
only = args[args.index("--only") + 1] if "--only" in args else ""
only_ids = args[args.index("--ids") + 1].split(",") if "--ids" in args else []
model_name = args[args.index("--model") + 1] if "--model" in args else "small"


def words(text: str) -> list[str]:
    text = text.lower().replace("ß", "ss")
    text = re.sub(r"[^a-zäöüéèàç0-9\s]", " ", text)
    return text.split()


def plain(text: str) -> str:
    return re.sub(r"\[[^\]]*\]", " ", text)


def tag_words(text: str) -> set[str]:
    tags = " ".join(re.findall(r"\[([^\]]*)\]", text))
    return {w for w in words(tags) if len(w) > 3}


model = WhisperModel(model_name, device="cpu", compute_type="int8")
done = json.loads(RESULT.read_text(encoding="utf-8")) if RESULT.exists() else {}
if only_ids:
    ids = [i for i in only_ids if i in LEDGER]  # gezielte Neuprüfung, auch wenn der Hash gleich ist
else:
    ids = [i for i in LEDGER if only in i and (i not in done or done[i].get("hash") != LEDGER[i]["hash"])]
print(f"{len(ids)} Clips zu prüfen (Modell {model_name})", flush=True)
for n, cid in enumerate(ids, 1):
    entry = LEDGER[cid]
    segs, _ = model.transcribe(str(OUT / f"{cid}.mp3"), language="de", beam_size=3, vad_filter=False, condition_on_previous_text=False)
    heard = " ".join(s.text.strip() for s in segs)
    want, got = words(plain(entry["text"])), words(heard)
    ratio = difflib.SequenceMatcher(None, want, got).ratio() if want else 1.0
    leaked = sorted(tag_words(entry["text"]) & set(got) - set(want))
    done[cid] = {"hash": entry["hash"], "ratio": round(ratio, 3), "heard": heard, "want": " ".join(want), "leaked": leaked, "duration": entry["duration"]}
    if n % 25 == 0:
        RESULT.write_text(json.dumps(done, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"[{n}/{len(ids)}]", flush=True)
RESULT.write_text(json.dumps(done, ensure_ascii=False, indent=1), encoding="utf-8")

rows = sorted(done.items(), key=lambda kv: kv[1]["ratio"])
print("\nSchlechteste Treffer (Wortübereinstimmung):")
for cid, r in rows[:40]:
    print(f"{r['ratio']:.2f} {cid} | soll: {r['want'][:90]} | gehört: {r['heard'][:90]} {'| TAG-WORTE: ' + ','.join(r['leaked']) if r['leaked'] else ''}")
print("\nClips mit möglicherweise gesprochenen Tag-Worten:", [cid for cid, r in done.items() if r["leaked"]][:60])
print("Mittelwert:", round(sum(r["ratio"] for r in done.values()) / len(done), 3), "| unter 0.7:", sum(1 for r in done.values() if r["ratio"] < 0.7))
