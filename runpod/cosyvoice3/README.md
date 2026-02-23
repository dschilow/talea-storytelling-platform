# RunPod Serverless Setup (CosyVoice 3 + Emotion)

This setup is prepared for **RunPod Serverless Load Balancer** (scale-to-zero, starts only on demand).

Backend in this repo already calls:
- `POST <COSYVOICE_RUNPOD_API_URL>/v1/tts`

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
2. Choose **Load Balancer** endpoint type.
3. Source: your GitHub repo.
4. Select repo + branch.
5. Dockerfile path: `runpod/cosyvoice3/Dockerfile`.
6. In `Container configuration`:
   - `Expose HTTP ports`: `80`
   - `Container disk`: `20 GB` (good start for this model)
7. Worker settings:
   - `Active workers`: `0` (this is scale-to-zero)
   - `Max workers`: `1` (start small)
8. GPU config:
   - choose at least 24 GB VRAM class for CosyVoice3 (`24 GB` option in UI is OK)
   - "Low/Medium/High supply" only means availability chance, not quality
9. Add environment variables:

```env
COSYVOICE_API_KEY=<strong-random-secret>
COSYVOICE_MODEL_ID=FunAudioLLM/Fun-CosyVoice3-0.5B-2512
COSYVOICE_MODEL_DIR=/opt/models/Fun-CosyVoice3-0.5B-2512
COSYVOICE_INFERENCE_TIMEOUT_SEC=1200
COSYVOICE_MAX_CONCURRENT=1
COSYVOICE_SYSTEM_PROMPT=You are a helpful assistant.

# Optional built-in speaker fallback (no reference_audio needed):
COSYVOICE_DEFAULT_SPK_ID=

# Optional default narrator fallback if request has no reference_audio:
COSYVOICE_DEFAULT_PROMPT_TEXT=Das ist meine Referenzstimme fuer Talea.
COSYVOICE_DEFAULT_REF_WAV_URL=https://<public-url>/narrator_sample.wav
```

10. Click `Deploy Endpoint`.

## C) Connect backend to RunPod

In backend `.env` (or production env):

```env
COSYVOICE_RUNPOD_API_URL=https://<your-endpoint-id>.api.runpod.ai
# RunPod gateway key (Bearer auth at RunPod edge)
COSYVOICE_RUNPOD_API_KEY=<your-runpod-api-key>

# Optional: only if your worker enforces COSYVOICE_API_KEY internally
COSYVOICE_RUNPOD_WORKER_API_KEY=<same-secret-as-COSYVOICE_API_KEY>
COSYVOICE_RUNPOD_TTS_PATH=/v1/tts
COSYVOICE_RUNPOD_TIMEOUT_MS=1200000
COSYVOICE_RUNPOD_MAX_RETRIES=3
COSYVOICE_RUNPOD_RETRY_BASE_DELAY_MS=1500
COSYVOICE_REFERENCE_FETCH_TIMEOUT_MS=30000
COSYVOICE_DEFAULT_OUTPUT_FORMAT=wav
```

Restart backend after env changes.

## D) Quick test

Health:

```bash
curl -s "https://<your-endpoint-id>.api.runpod.ai/ping"
```

TTS:

```bash
curl -X POST "https://<your-endpoint-id>.api.runpod.ai/v1/tts" \
  -H "Authorization: Bearer <COSYVOICE_API_KEY>" \
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
  -F "text=Es war einmal ein kleiner Stern, der leuchten wollte." \
  -F "speaker=<built-in-speaker-id-optional>" \
  -F "output_format=wav" \
  --output out.wav
```

## E) Cold start behavior

- When idle, workers go to 0 (no GPU billing).
- First request after idle must start worker + load model (can take a few minutes).
- While warm, generation starts much faster.

## F) RunPod LB timeout note

- RunPod Load Balancer endpoints are not ideal for very long single HTTP requests.
- If one `/v1/tts` call runs too long, the connection can drop even if the worker is healthy.
- Keep each TTS request short (chunk long story text) or move to a Queue endpoint for long jobs.
