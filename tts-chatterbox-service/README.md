# Chatterbox TTS Service (CPU)

Separater Docker-Service für A/B-Vergleich mit dem bestehenden `tts-service` (Piper/Thorsten).

## Ziel

- **Bestehendes Setup bleibt unverändert** (`tts-service` = Piper/Thorsten)
- **Neues Setup zusätzlich** (`tts-chatterbox-service`)
- Umschaltung erfolgt im Backend über `provider: "chatterbox"`

## Empfohlene Modellwahl

Für **Deutsch + CPU** ist in diesem Setup `multilingual` sinnvoll.

- `multilingual`: unterstützt `language_id="de"`
- `turbo`: primär Englisch und eher Voice-Agent/Low-Latency-fokussiert

## Environment-Variablen

- `CHATTERBOX_MODEL` = `multilingual` (default) oder `turbo`
- `CHATTERBOX_DEVICE` = `cpu` (default)
- `CHATTERBOX_DEFAULT_LANGUAGE` = `de` (default)
- `MAX_CHUNK_CHARS` (optional)
- `MAX_PARALLEL_CHUNKS` (optional, default 1 für Stabilität auf CPU)
- `CHATTERBOX_CPU_THREADS` (optional, z. B. `8` oder `16`)
- `CHATTERBOX_CPU_INTEROP_THREADS` (optional, default `1`)
- `CHATTERBOX_MTL_MAX_NEW_TOKENS` (optional, default `1000`; kleiner = schneller, aber Risiko von abgeschnittenem Audio)
- `CHATTERBOX_PRELOAD_MODEL` (optional, default `true`; lädt Modell direkt beim Worker-Start)

## Railway

Nutze `tts-chatterbox-service/railway.toml` als Service-Konfiguration.

Für das Backend zusätzlich setzen:

- `CHATTERBOX_TTS_SERVICE_URL=http://<dein-service>.railway.internal:8080`
- Alternative je nach Railway-Setup: `CHATTERBOX_TTS_SERVICE_URL=http://<dein-service>.railway.internal`
- Optional für langsame CPU-Läufe: `CHATTERBOX_POLL_TIMEOUT_MS=1800000` (30 Minuten)
- Optional für A/B-Tests ohne Fallback: `TTS_STRICT_PROVIDER=true` (bei explizitem `provider: "chatterbox"`)

`TTS_SERVICE_URL` bleibt auf deinem bestehenden Thorsten-Service.

## Performance-Hinweise (CPU)

- `multilingual` auf CPU kann sehr langsam sein (insb. bei langen Texten).
- Starte mit:
  - `CHATTERBOX_CPU_THREADS=16`
  - `CHATTERBOX_CPU_INTEROP_THREADS=1`
  - `CHATTERBOX_MTL_MAX_NEW_TOKENS=300` (nur zum Testen; ggf. erhöhen, falls Audio abgeschnitten wird)
- Für echte Produktionslatenz ist meist eine GPU nötig oder `CHATTERBOX_MODEL=turbo` (qualitativ/sprachlich anders).
