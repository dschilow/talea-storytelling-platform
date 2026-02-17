FROM python:3.11-slim

WORKDIR /app

# Runtime/system deps for audio + model loading
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Prefer CPU wheels for torch on Railway CPU instances
ENV PIP_EXTRA_INDEX_URL=https://download.pytorch.org/whl/cpu
ENV HF_HOME=/app/.cache/huggingface
ENV CHATTERBOX_DEVICE=cpu
ENV CHATTERBOX_MODEL=multilingual
ENV CHATTERBOX_DEFAULT_LANGUAGE=de
ENV CUDA_VISIBLE_DEVICES=""

COPY tts-chatterbox-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY tts-chatterbox-service/server.py .

EXPOSE 8080

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-8080} --timeout 1800 --workers 1 --threads 1 server:app"]
