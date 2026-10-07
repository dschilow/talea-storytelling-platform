# Thorsten-Voice CosyVoice3 Worker (RunPod GPU)

Zweite Thorsten-Stimme zum Vergleich mit [Kokoro](../../tts-thorsten-kokoro-service/README.md).
Modell: [Thorsten-Voice/CosyVoice3](https://huggingface.co/Thorsten-Voice/CosyVoice3) (Feintuning von
Fun-CosyVoice3-0.5B-2512, Apache 2.0). Im Backend ist das der Provider `thorsten-cosyvoice`
([backend/tts/thorsten-cosyvoice-tts.ts](../../backend/tts/thorsten-cosyvoice-tts.ts)).

Textaufbereitung, Pausen und Lautheit kommen aus denselben Modulen wie bei Kokoro
(`textprep.py`, `audioprep.py`), damit sich nur das Modell unterscheidet.

## Warum GPU

Laut Model Card: ca. 13 s fuer 80 Woerter auf einer RTX 4090, ca. 4:30 min auf einer CPU (M1).
Auf Railway-CPU waere das fuer ganze Geschichten zu langsam.

## RunPod-Endpoint anlegen

1. RunPod -> Serverless -> New Endpoint -> **Queue**, Quelle: GitHub-Repo, Branch `main`
2. Dockerfile-Pfad: `runpod/thorsten-cosyvoice3/Dockerfile`, Build-Kontext: Repo-Root
3. GPU: 16 GB VRAM reichen, Active Workers `0`, Max Workers `1-2`, Container Disk `30 GB`
4. Optional Network Volume anhaengen: die ~5 GB Gewichte landen dann in `/runpod-volume` und
   werden nicht bei jedem Kaltstart neu geladen. Alternativ Build-Arg `PREFETCH_MODEL=1` (groesseres Image).
5. Env (optional): `COSYVOICE_DEFAULT_SPEED` (1.0), `COSYVOICE_FP16` (1), Pausen/Lautheit wie bei Kokoro
   (`SENTENCE_PAUSE_S`, `PARAGRAPH_PAUSE_S`, `TARGET_LUFS`, ...)

Backend (Railway, Service `backend 2`):

```env
THORSTEN_COSYVOICE_URL=https://api.runpod.ai/v2/<endpoint-id>
THORSTEN_COSYVOICE_API_KEY=<RunPod API key>
```

Ein Job: `{"input": {"text": "...", "speed": 1.0, "format": "mp3"}}` ->
`{"audio_base64", "mime_type", "output_format", "duration"}`.

## Lokal testen (HTTP-Modus)

```bash
# aus dem Repo-Root
docker build -f runpod/thorsten-cosyvoice3/Dockerfile -t thorsten-cosyvoice3 .
docker run --rm -p 8090:80 -e WORKER_MODE=http -v cosyvoice-models:/opt/models thorsten-cosyvoice3
curl -X POST localhost:8090/tts -H "Content-Type: application/json" \
  -d '{"text":"Hallo, hier spricht Thorsten.","format":"wav"}' -o test.wav
```

Mit `--gpus all` laeuft es auf einer lokalen NVIDIA-GPU, ohne GPU auf der CPU (langsam).
Das Backend kann den Worker im HTTP-Modus direkt nutzen: `THORSTEN_COSYVOICE_URL=http://host:8090`.
