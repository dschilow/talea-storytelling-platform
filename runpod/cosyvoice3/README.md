# RunPod Serverless Setup (CosyVoice 3 + Emotion)

This setup supports both:
- **RunPod Serverless Load Balancer** (HTTP `/v1/tts`)
- **RunPod Serverless Queue** (`/run` + `/status/{id}`)

## A) Commit these files first

1. Commit and push:
   - `runpod/cosyvoice3/Dockerfile`
   - `runpod/cosyvoice3/server.py`
   - `runpod/cosyvoice3/entrypoint.sh`
   - backend env updates (`.env.example`)
2. Wait until GitHub shows the new commit.

Important: if RunPod build logs still show `torch==2.5.1`, you are building an old commit or wrong Dockerfile path.

## B) Create RunPod Serverless endpoint

1. Open RunPod -> `Serverless` -> `Create Endpoint`.
2. Choose endpoint type:
   - **Load Balancer** -> set `COSYVOICE_WORKER_MODE=http`
   - **Queue based** -> set `COSYVOICE_WORKER_MODE=queue`
3. Source: your GitHub repo.
4. Select repo + branch.
5. Dockerfile path: `runpod/cosyvoice3/Dockerfile`.
6. In `Container configuration`:
   - `Expose HTTP ports`: `80`
   - `Container disk`: `40-50 GB` (recommended for stable cold starts)
7. Worker settings:
   - `Active workers`: `0` (this is scale-to-zero)
   - `Max workers`: `1` (start small)
8. GPU config:
   - choose at least 24 GB VRAM class for CosyVoice3 (`24 GB` option in UI is OK)
   - "Low/Medium/High supply" only means availability chance, not quality
9. Add environment variables:

```env
COSYVOICE_MODEL_ID=FunAudioLLM/Fun-CosyVoice3-0.5B-2512
COSYVOICE_MODEL_DIR=/opt/models/Fun-CosyVoice3-0.5B-2512
COSYVOICE_INFERENCE_TIMEOUT_SEC=1200
COSYVOICE_MAX_CONCURRENT=1
COSYVOICE_HF_CACHE_DIR=/opt/hf-cache
COSYVOICE_CLEAR_HF_CACHE_AFTER_DOWNLOAD=1
COSYVOICE_WORKER_MODE=http
COSYVOICE_USE_DEFAULT_PROMPT_TEXT=1
COSYVOICE_ZERO_SHOT_MIN_TEXT_CHARS=0

# Optional worker-internal auth layer:
# If set, backend must send COSYVOICE_RUNPOD_WORKER_API_KEY (X-API-Key header).
# If not set, worker accepts requests without extra worker key.
# COSYVOICE_API_KEY=<strong-random-secret>

# Optional built-in speaker fallback (no reference_audio needed):
COSYVOICE_DEFAULT_SPK_ID=

# Optional default narrator fallback if request has no reference_audio:
# IMPORTANT: exact transcript of your default reference clip (verbatim)
COSYVOICE_DEFAULT_REFERENCE_TRANSCRIPT=Duenn, ja... aber unterschaetz sie nicht. [short pause] Spinnenseide ist wie... ein ultraleichtes Seil, das trotzdem MEGA stark ist.
# Legacy alias (kept for compatibility):
COSYVOICE_DEFAULT_PROMPT_TEXT=
COSYVOICE_DEFAULT_REF_WAV_URL=https://<public-url>/narrator_sample.wav
```

Quality note:
- For best German pronunciation, prefer zero-shot with exact reference transcript:
  - set `COSYVOICE_DEFAULT_REFERENCE_TRANSCRIPT` to the exact spoken text in your reference clip.
  - keep `COSYVOICE_USE_DEFAULT_PROMPT_TEXT=1`.
- Keep `COSYVOICE_ZERO_SHOT_MIN_TEXT_CHARS=0` to avoid switching short chunks to cross-lingual.
- If `COSYVOICE_DEFAULT_REFERENCE_TRANSCRIPT` is set, worker-side default transcript is preferred for default voice requests.

10. Click `Deploy Endpoint`.

Note on image size / build quota:
- Dockerfile now defaults to `PREFETCH_MODEL=0` to avoid embedding the full model in the image layer.
- The model is downloaded on worker startup into `/opt/models` if missing.
- If you explicitly want prefetch in image build (larger image), set build arg `PREFETCH_MODEL=1`.
- If logs show `No space left on device`, increase container disk first, then redeploy workers.

## C) Connect backend to RunPod

In backend `.env` (or production env):

```env
COSYVOICE_RUNPOD_API_URL=https://<your-endpoint-id>.api.runpod.ai
# RunPod gateway key (Bearer auth at RunPod edge)
COSYVOICE_RUNPOD_API_KEY=<your-runpod-api-key>

# Required if your worker sets COSYVOICE_API_KEY internally
COSYVOICE_RUNPOD_WORKER_API_KEY=<same-secret-as-COSYVOICE_API_KEY>
COSYVOICE_RUNPOD_TTS_PATH=/v1/tts
COSYVOICE_RUNPOD_TIMEOUT_MS=1200000
COSYVOICE_RUNPOD_MAX_RETRIES=3
COSYVOICE_RUNPOD_RETRY_BASE_DELAY_MS=1500
COSYVOICE_REFERENCE_FETCH_TIMEOUT_MS=30000
COSYVOICE_DEFAULT_OUTPUT_FORMAT=wav
```

Queue endpoint backend example:

```env
COSYVOICE_RUNPOD_ENDPOINT_MODE=queue
COSYVOICE_RUNPOD_API_URL=https://api.runpod.ai/v2/<your-endpoint-id>
COSYVOICE_RUNPOD_API_KEY=<your-runpod-api-key>
COSYVOICE_RUNPOD_TIMEOUT_MS=1200000
COSYVOICE_RUNPOD_MAX_RETRIES=3
COSYVOICE_RUNPOD_RETRY_BASE_DELAY_MS=1500
COSYVOICE_RUNPOD_QUEUE_POLL_MS=2000
COSYVOICE_REFERENCE_FETCH_TIMEOUT_MS=30000
COSYVOICE_DEFAULT_OUTPUT_FORMAT=wav
COSYVOICE_USE_DEFAULT_PROMPT_TEXT=0
COSYVOICE_PREFER_WORKER_DEFAULT_REFERENCE=1
COSYVOICE_REFERENCE_AUDIO_CACHE_TTL_MS=3600000
# Optional fallback if worker has no default reference:
# COSYVOICE_DEFAULT_REFERENCE_AUDIO_URL=https://<public-url>/narrator_sample.wav
```

Important:
- For Queue mode, do **not** append `/run` in `COSYVOICE_RUNPOD_API_URL`.
- Use only the base: `https://api.runpod.ai/v2/<endpoint-id>`.
- `COSYVOICE_RUNPOD_TTS_PATH` is only relevant for Load Balancer mode.

Restart backend after env changes.

## D) Quick test

Health:

```bash
curl -s "https://<your-endpoint-id>.api.runpod.ai/ping"
```

TTS:

```bash
curl -X POST "https://<your-endpoint-id>.api.runpod.ai/v1/tts" \
  -H "Authorization: Bearer <RUNPOD_API_KEY>" \
  -H "X-API-Key: <COSYVOICE_API_KEY>" \
  -F "text=Es war einmal ein kleiner Stern, der leuchten wollte." \
  -F "prompt_text=Das ist meine Referenzstimme fuer Talea." \
  -F "reference_audio=@narrator_sample.wav" \
  -F "emotion=happy" \
  -F "output_format=wav" \
  --output out.wav
```

Without reference audio (use built-in speaker):

```bash
curl -X POST "https://<your-endpoint-id>.api.runpod.ai/v1/tts" \
  -H "Authorization: Bearer <RUNPOD_API_KEY>" \
  -H "X-API-Key: <COSYVOICE_API_KEY>" \
  -F "text=Es war einmal ein kleiner Stern, der leuchten wollte." \
  -F "speaker=<built-in-speaker-id-optional>" \
  -F "output_format=wav" \
  --output out.wav
```

If your worker does not set `COSYVOICE_API_KEY`, omit `X-API-Key`.

## E) Cold start behavior

- When idle, workers go to 0 (no GPU billing).
- First request after idle must start worker + load model (can take a few minutes).
- While warm, generation starts much faster.

## F) RunPod LB timeout note

- RunPod Load Balancer endpoints are not ideal for very long single HTTP requests.
- If one `/v1/tts` call runs too long, the connection can drop even if the worker is healthy.
- Keep each TTS request short (chunk long story text) or move to a Queue endpoint for long jobs.
