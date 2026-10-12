# MOSS-TTS-Nano TTS Service

Eigener Railway-Service fuer **MOSS-TTS-Nano** ([OpenMOSS-Team/MOSS-TTS-Nano](https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Nano),
0,1 Mrd. Parameter, Apache 2.0, ONNX Runtime auf der CPU, 48 kHz). Gedacht als Gegenstueck zu
[Thorsten/Kokoro](../tts-thorsten-kokoro-service/README.md): gleiche HTTP-Schnittstelle, gleiche Textaufbereitung
und gleiche Nachbearbeitung, damit sich beide im Story-Player direkt vergleichen lassen.
Das Backend spricht den Service ueber `provider: "moss-nano"` an ([backend/tts/moss-tts.ts](../backend/tts/moss-tts.ts)).

MOSS-TTS-Nano bringt keine deutschen Stimmen mit, jede Stimme ist ein **Klon eines kurzen Referenz-Clips** aus
[voices/](voices/). Der mitgelieferte Clip `thorsten_neutral.wav` (9,8 s) besteht aus zwei Saetzen des
[Thorsten-Voice-Datensatzes](https://huggingface.co/datasets/Thorsten-Voice/TV-24kHz-Neutral) (Thorsten Mueller,
laut Dataset-Karte CC-BY-4.0, Namensnennung: "Thorsten-Voice / Thorsten Mueller"). Dieselbe Stimme wie bei Kokoro,
so entscheidet nur das Modell. Weitere Stimmen: einfach eine `*.wav` (mono/stereo, 5-15 s, saubere Aufnahme) nach
`voices/` legen, die Datei heisst dann `voice`-ID.

## API

| Endpoint | Zweck |
|---|---|
| `GET /health` | 200 erst wenn Modell und Referenz-Clips geladen sind |
| `GET /voices` | verfuegbare Stimmen-IDs |
| `POST /tts` | `{"text": "...", "voice"?: "thorsten_neutral", "seed"?: 7, "format": "mp3" \| "wav"}` -> Audio-Bytes |

Die Antwort enthaelt `X-Audio-Duration` und `X-Processing-Seconds`, daraus ergibt sich der Echtzeitfaktor.
Der Service loggt ihn bei jeder Anfrage (`x2.1 realtime` = 2,1-fach schneller als Echtzeit).

Wie bei Kokoro ([textprep.py](textprep.py), [audioprep.py](audioprep.py)): Zahlen/Abkuerzungen/Zitate werden
ausgeschrieben, ein Modellaufruf pro Satz, Modell-Stille wird abgeschnitten und durch feste Pausen ersetzt, am Ende
Hochpass + EBU-R128-Normalisierung auf -16 LUFS. **Die beiden Dateien sind Kopien** aus `tts-thorsten-kokoro-service/`
(`railway up --path-as-root` laedt nur diesen Ordner hoch); `python -m unittest test_shared_modules` schlaegt an,
wenn sie auseinanderlaufen.

Unterschiede zu Kokoro:
- Kein Tempo-Regler. Das Tempo folgt dem Referenz-Clip.
- Das Modell ist ein Sampler: gleicher Text klingt bei jedem Lauf etwas anders. Mit `seed` reproduzierbar.
- Ein Satz, der sein Ende nicht findet (laeuft ins Frame-Limit), wird bis zu `MOSS_MAX_RETRIES` Mal neu gewuerfelt.

## Environment-Variablen (Service)

- `API_KEY` (optional): wenn gesetzt, verlangt `/tts` `Authorization: Bearer <key>`
- `MOSS_DEFAULT_VOICE` (default `thorsten_neutral`)
- `MOSS_CPU_THREADS` (default: min(4, CPU-Kerne)). Gemessen (Desktop-CPU, Docker): 1 Thread Echtzeitfaktor 1,4 /
  2 Threads 1,0 / 4 Threads 0,8, mehr bringt nichts. Railway meldet die Host-Kerne, bei kleinerem vCPU-Limit absenken.
- `MOSS_SAMPLE_MODE` (`fixed` | `greedy` | `full`, default `fixed`), `MOSS_STREAMING_DECODE` (`0` default, `1` = der
  Streaming-Decode des Upstream, auf der CPU etwa doppelt so langsam)
- `MOSS_MAX_NEW_FRAMES` (375 = 30 s je Modellaufruf), `MOSS_FRAMES_PER_CHAR_CAP` (2.0), `MOSS_MAX_RETRIES` (2)
- `MOSS_MAX_TEXT_TOKENS` (75, Chunk-Budget des Upstream), `GROUP_MAX_CHARS` (180), `MOSS_CHUNK_PAUSE_S` (0.15)
- Pausen, Lautheit, MP3-Bitrate, Queue: wie bei Kokoro (`SENTENCE_PAUSE_S`, `TARGET_LUFS`, `MP3_BITRATE`, `MAX_QUEUE`, ...)

## Environment-Variablen (Backend)

- `MOSS_TTS_SERVICE_URL=http://tts-moss-nano.railway.internal:8080`
- `MOSS_TTS_API_KEY` (optional, gleich wie `API_KEY` des Services)
- `MOSS_TTS_VOICE` (optional, Standardstimme ueberschreiben)

## Lokal testen

```bash
docker build -f Dockerfile.moss -t moss-nano .
docker run --rm -p 8080:8080 moss-nano
curl -X POST localhost:8080/tts -H "Content-Type: application/json" \
  -d '{"text":"Es war einmal ein kleiner Fuchs, der hatte grosse Traeume.","format":"wav"}' -o test.wav
```

## Deployment (Railway)

Service `tts-moss-nano` im Projekt Talea (Production), neben `tts-thorsten-kokoro`. Deploy per CLI aus dem Repo-Root:

```bash
railway up tts-moss-nano-service --path-as-root --service tts-moss-nano --environment production --detach
```

Hinweise (gleiche Fallen wie beim Kokoro-Service):
- Die Dockerfile heisst `Dockerfile.moss`: `railway up` laesst Dateien namens exakt `Dockerfile` weg. Neue
  "Empty Service" haben den Builder RAILPACK, `dockerfilePath` muss per GraphQL `serviceInstanceUpdate` gesetzt werden.
- Privates Netz ist IPv6-only: gunicorn bindet an `[::]`, sonst "fetch failed" im Backend.
- Der Service hat keine oeffentliche Domain; das Backend erreicht ihn ueber `tts-moss-nano.railway.internal:8080`.
- Das Image enthaelt Modell und Referenz-Clips (~1,5 GB), der Build laedt ~760 MB von Hugging Face.
- MOSS-TTS-Nano ist auf Commit `8b7bcc9` festgenagelt (Dockerfile).
