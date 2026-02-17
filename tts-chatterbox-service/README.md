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

## Railway

Nutze `tts-chatterbox-service/railway.toml` als Service-Konfiguration.

Für das Backend zusätzlich setzen:

- `CHATTERBOX_TTS_SERVICE_URL=http://<dein-service>.railway.internal:8080`
- Alternative je nach Railway-Setup: `CHATTERBOX_TTS_SERVICE_URL=http://<dein-service>.railway.internal`

`TTS_SERVICE_URL` bleibt auf deinem bestehenden Thorsten-Service.
