# Thorsten-Voice (Kokoro) TTS Service

Eigener Railway-Service fuer die deutsche Stimme **Thorsten-Voice (Kokoro)**.
Modell: [Thorsten-Voice/Kokoro](https://huggingface.co/Thorsten-Voice/Kokoro) (Kokoro-82M Fine-Tune, Apache 2.0, laeuft auf CPU, 24 kHz).
Das Backend spricht ihn ueber `provider: "thorsten"` an ([backend/tts/thorsten-tts.ts](../backend/tts/thorsten-tts.ts)).

## API

| Endpoint | Zweck |
|---|---|
| `GET /health` | 200 erst wenn das Modell geladen ist |
| `POST /tts` | `{"text": "...", "speed": 1.0, "format": "mp3" \| "wav"}` -> Audio-Bytes |

Der Server normalisiert den Text (Anfuehrungszeichen, Gedankenstriche, Zahlen -> Woerter, xAI-Tags werden entfernt),
teilt ihn in Saetze und setzt Pausen zwischen Saetzen und Absaetzen.

## Environment-Variablen (Service)

- `API_KEY` (optional): wenn gesetzt, verlangt `/tts` `Authorization: Bearer <key>`
- `KOKORO_EPOCH` (1-10, default `5`): Trainings-Checkpoint
- `KOKORO_DEFAULT_SPEED` (default `1.0`)
- `KOKORO_CPU_THREADS` (default: min(8, CPU-Kerne))
- `GROUP_MAX_CHARS` (default `240`), `SENTENCE_PAUSE_S`, `PARAGRAPH_PAUSE_S`, `MP3_BITRATE`, `MAX_QUEUE`

## Environment-Variablen (Backend)

- `THORSTEN_TTS_SERVICE_URL=http://tts-thorsten-kokoro.railway.internal:8080`
- `THORSTEN_TTS_API_KEY` (optional, gleich wie `API_KEY` des Services)
- `THORSTEN_TTS_SPEED` (optional)

## Lokal testen

```bash
docker build -f Dockerfile.kokoro -t thorsten-kokoro .
docker run --rm -p 8080:8080 thorsten-kokoro
curl -X POST localhost:8080/tts -H "Content-Type: application/json" \
  -d '{"text":"Hallo, hier spricht Thorsten.","format":"wav"}' -o test.wav
```

## Deployment (Railway)

Service `tts-thorsten-kokoro` im Projekt Talea (Production). Deploy per CLI aus dem Repo-Root:

```bash
railway up tts-thorsten-kokoro-service --path-as-root --service tts-thorsten-kokoro --environment production --detach
```

Hinweise:
- Die Dockerfile heisst bewusst `Dockerfile.kokoro`: `railway up` laesst Dateien namens `Dockerfile` im Upload weg
  (Build scheitert mit "failed to read Dockerfile"). Der Pfad ist im Service als `dockerfilePath` hinterlegt.
- Der Service hat keine oeffentliche Domain; das Backend erreicht ihn ueber `tts-thorsten-kokoro.railway.internal:8080`.
