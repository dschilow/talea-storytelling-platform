# RunPod Serverless Setup (CosyVoice 3 + Emotion)

This setup is prepared for **RunPod Serverless Load Balancer** (scale-to-zero, starts only on demand).

Backend in this repo already calls:
- `POST <COSYVOICE_RUNPOD_API_URL>/v1/tts`

So your only job is to deploy this worker and copy endpoint URL + API key into backend env.

## A) One-time in your repo

1. Commit and push these files:
   - `runpod/cosyvoice3/Dockerfile`
   - `runpod/cosyvoice3/server.py`
   - `runpod/cosyvoice3/entrypoint.sh`
   - backend env updates (`.env.example`)
2. Wait until GitHub has latest commit.

## B) Create RunPod Serverless endpoint (UI)

1. Open RunPod -> `Serverless` -> `Create Endpoint`.
2. Choose **Load Balancer endpoint** (HTTP workers).
3. For source choose **GitHub repo**.
4. Select your repository + branch.
5. Dockerfile path: `runpod/cosyvoice3/Dockerfile`.
6. Set exposed HTTP port to `80`.
7. GPU: choose your target (e.g. RTX 4000 Ada class if available in your plan/region).
8. Worker autoscaling:
   - `Min workers = 0` (important for scale-to-zero)
   - `Max workers = 1` (start simple, increase later)
9. Add env vars in RunPod endpoint:

```env
COSYVOICE_API_KEY=<strong-random-secret>
COSYVOICE_MODEL_ID=FunAudioLLM/CosyVoice-300M-25Hz
COSYVOICE_MODEL_DIR=/opt/models/CosyVoice-300M-25Hz
COSYVOICE_INFERENCE_TIMEOUT_SEC=1200
COSYVOICE_MAX_CONCURRENT=1

# Optional default narrator fallback (if client sends no reference file)
COSYVOICE_DEFAULT_PROMPT_TEXT=Hallo, ich bin dein Erzahler und lese dir jetzt eine Geschichte vor.
COSYVOICE_DEFAULT_REF_WAV_URL=https://<public-url>/narrator_sample.wav
```

10. Deploy endpoint.

## C) Connect backend to RunPod

In backend `.env` (or production env):

```env
COSYVOICE_RUNPOD_API_URL=https://<your-endpoint-id>.api.runpod.ai
COSYVOICE_RUNPOD_API_KEY=<same-secret-as-COSYVOICE_API_KEY>
COSYVOICE_RUNPOD_TTS_PATH=/v1/tts
COSYVOICE_RUNPOD_TIMEOUT_MS=1200000
COSYVOICE_RUNPOD_MAX_RETRIES=3
COSYVOICE_RUNPOD_RETRY_BASE_DELAY_MS=1500
COSYVOICE_REFERENCE_FETCH_TIMEOUT_MS=30000
COSYVOICE_DEFAULT_OUTPUT_FORMAT=wav
```

Restart backend after setting env vars.

## D) Verify endpoint

Health:

```bash
curl -s "https://<your-endpoint-id>.api.runpod.ai/ping"
```

TTS test:

```bash
curl -X POST "https://<your-endpoint-id>.api.runpod.ai/v1/tts" \
  -H "Authorization: Bearer <COSYVOICE_API_KEY>" \
  -F "text=Es war einmal ein kleiner Stern, der leuchten wollte." \
  -F "prompt_text=Hallo, ich bin dein Erzahler." \
  -F "reference_audio=@narrator_sample.wav" \
  -F "emotion=happy" \
  -F "output_format=wav" \
  --output out.wav
```

## E) What to expect in production

- If no traffic: workers go to zero.
- First request after idle triggers cold start (can take minutes).
- After warm-up, next requests are much faster.

## F) Notes

- This worker supports:
  - `prompt_text` + `reference_audio` (zero-shot clone)
  - `emotion` (mapped to instruct style)
  - `instruct_text` (explicit style override)
  - `output_format` wav/mp3
- Backend already sends auth header and handles retries/timeouts.
