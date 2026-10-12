# Thorsten-Voice (Kokoro) TTS Service

Eigener Railway-Service fuer die deutsche Stimme **Thorsten-Voice (Kokoro)**.
Modell: [Thorsten-Voice/Kokoro](https://huggingface.co/Thorsten-Voice/Kokoro) (Kokoro-82M Fine-Tune, Apache 2.0, laeuft auf CPU, 24 kHz).
Das Backend spricht ihn ueber `provider: "thorsten"` an ([backend/tts/thorsten-tts.ts](../backend/tts/thorsten-tts.ts)).

## API

| Endpoint | Zweck |
|---|---|
| `GET /health` | 200 erst wenn das Modell geladen ist |
| `POST /tts` | `{"text": "...", "voice": "thorsten", "speed": 0.95, "format": "mp3" \| "wav"}` -> Audio-Bytes |

## Stimmen

Nur `thorsten`. Kokoro klont keine Stimmen aus einem Hoerbeispiel: jede Stimme ist ein eigenes Feintuning.
Am 2026-10-12 getestet und nach dem Hoertest wieder entfernt: kikiri-tts `martin`/`victoria` (synthetische
Trainingsdaten, Akzent) und `kerstin` (CC0-Datensatz, klang blechern; Achtung: ihre Modellkarte zeigt nur das
Voicepack auf den Basisgewichten von Kokoro-82M, die kein Deutsch koennen; ihr eigentliches Modell liegt als roher
Stage-2-Checkpoint im Repo und muss mit kikiri-tts `convert_checkpoint` umgewandelt werden).

## Tempo-Ausgleich

Kokoro spricht lange Eingaben deutlich schneller als kurze. Gemessen an einem Kapitel (Tempo 0,85): unter 60 Phonemen
3,6 Silben/s, ab 120 Phonemen 5,3 Silben/s (Korrelation +0,84) - eine Geschichte wurde dadurch satzweise schneller
und langsamer. `KPipeline` nimmt das Tempo auch als Funktion der Phonemzahl; der Service skaliert das angefragte Tempo
mit `(1 + k*ref) / (1 + k*len)` (k = 0,0048, ref = 50 Phoneme, Faktor begrenzt auf 0,72-1,2). Ergebnis: Streuung
0,77 -> 0,43 Silben/s, kurze Saetze 3,8 / lange 3,6 Silben/s (Korrelation -0,05 statt +0,84). Abschalten mit `KOKORO_TEMPO_COMPENSATION=0`;
Stellschrauben `KOKORO_TEMPO_SLOPE`, `KOKORO_TEMPO_REF_PHONEMES`, `KOKORO_TEMPO_MIN_FACTOR`, `KOKORO_TEMPO_MAX_FACTOR`.

Grenze: Ausdruck (Emotion, Maerchen-Ton) kann dieses Modell nicht. Thorsten-Kokoro ist auf neutral vorgelesene
Einzelsaetze trainiert und klingt deshalb eher nach Ansage.

Die Ausgabe ist auf Kindergeschichten abgestimmt ([textprep.py](textprep.py), [audioprep.py](audioprep.py)).
Beide Module nutzt auch der CosyVoice3-Worker ([runpod/thorsten-cosyvoice3](../runpod/thorsten-cosyvoice3/README.md)):

- Text: Anfuehrungszeichen, Gedankenstriche, Klammern, Abkuerzungen (z. B., Dr., usw.), Uhrzeiten, Einheiten
  und Zahlen werden ausgeschrieben; Markdown, Emojis, xAI-Tags und Mehrfach-Satzzeichen fallen weg.
- Tempo: Default-Speed `0.95` mit Tempo-Ausgleich, ca. 4,2 Silben/s im Kapitel (0,85 mit Ausgleich = 3,8 war dem
  User zu langsam; ohne Ausgleich klang 1.0 gehetzt).
- Rhythmus: ein Modellaufruf pro Satz, Stille des Modells wird abgeschnitten und durch feste Pausen je
  Satzende ersetzt (Punkt, Frage, Ausruf, Auslassungspunkte, Absatz, Chunk-Ende).
- Klang: Hochpass 60 Hz und zweistufige EBU-R128-Normalisierung (lineare Verstaerkung) auf -16 LUFS / -1.5 dBTP,
  damit alle Chunks gleich laut sind.

## Environment-Variablen (Service)

- `API_KEY` (optional): wenn gesetzt, verlangt `/tts` `Authorization: Bearer <key>`
- `KOKORO_EPOCH` (1-10, default `5`): Trainings-Checkpoint
- `KOKORO_DEFAULT_SPEED` (default `0.95`)
- `KOKORO_CPU_THREADS` (default: min(8, CPU-Kerne))
- `GROUP_MAX_CHARS` (default `220`): laengster Text pro Modellaufruf, laengere Saetze werden an Kommas geteilt
- Pausen in Sekunden: `SENTENCE_PAUSE_S` (0.45), `QUESTION_PAUSE_S` (0.55), `EXCLAMATION_PAUSE_S` (0.5),
  `ELLIPSIS_PAUSE_S` (0.8), `COLON_PAUSE_S` (0.35), `CLAUSE_PAUSE_S` (0.15), `PARAGRAPH_PAUSE_S` (1.0),
  `END_PAUSE_S` (0.8), `LEAD_IN_S` (0.1)
- Lautheit: `LOUDNORM` (`0` schaltet ab, dann gilt `OUTPUT_GAIN_DB`), `TARGET_LUFS` (-16), `TRUE_PEAK_DB` (-1.5),
  `HIGHPASS_HZ` (60)
- `MP3_BITRATE`, `MAX_QUEUE`

## Environment-Variablen (Backend)

- `THORSTEN_TTS_SERVICE_URL=http://tts-thorsten-kokoro.railway.internal:8080`
- `THORSTEN_TTS_API_KEY` (optional, gleich wie `API_KEY` des Services)
- `THORSTEN_TTS_SPEED` (optional)

## Lokal testen

```bash
python -m unittest test_textprep   # Textaufbereitung, braucht nur num2words
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
