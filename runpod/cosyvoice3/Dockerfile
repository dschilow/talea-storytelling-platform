FROM pytorch/pytorch:2.3.1-cuda12.1-cudnn8-runtime

ARG PREFETCH_MODEL=0

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_PREFER_BINARY=1 \
    HF_HOME=/opt/hf-cache \
    PYTHONPATH=/opt/cosyvoice \
    COSYVOICE_MODEL_ID=FunAudioLLM/Fun-CosyVoice3-0.5B-2512 \
    COSYVOICE_MODEL_DIR=/opt/models/Fun-CosyVoice3-0.5B-2512

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    git-lfs \
    ffmpeg \
    sox \
    libsndfile1 \
    ca-certificates \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/cosyvoice
RUN git clone --recursive --depth 1 https://github.com/FunAudioLLM/CosyVoice.git /opt/cosyvoice

RUN pip install --upgrade pip setuptools wheel cython && \
    awk ' \
      BEGIN{IGNORECASE=1} \
      /^--extra-index-url .*onnxruntime-cuda-12/ {next} \
      /^deepspeed==/ {next} \
      /^fastapi-cli==/ {next} \
      /^gradio==/ {next} \
      /^grpcio==/ {next} \
      /^grpcio-tools==/ {next} \
      /^lightning==/ {next} \
      /^matplotlib==/ {next} \
      /^openai-whisper==/ {next} \
      /^pyarrow==/ {next} \
      /^pyworld==/ {next} \
      /^tensorboard==/ {next} \
      /^tensorrt-cu12==/ {next} \
      /^tensorrt-cu12-bindings==/ {next} \
      /^tensorrt-cu12-libs==/ {next} \
      {print} \
    ' requirements.txt > requirements.serverless.txt && \
    pip install --no-cache-dir -r requirements.serverless.txt && \
    pip install --no-cache-dir fastapi==0.115.6 uvicorn[standard]==0.30.0 python-multipart huggingface_hub pydub requests

RUN if [ "$PREFETCH_MODEL" = "1" ]; then \
      python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='FunAudioLLM/Fun-CosyVoice3-0.5B-2512', local_dir='/opt/models/Fun-CosyVoice3-0.5B-2512', local_dir_use_symlinks=False, resume_download=True)"; \
    else \
      echo "Skipping model prefetch during build (PREFETCH_MODEL=$PREFETCH_MODEL)"; \
    fi

COPY runpod/cosyvoice3/server.py /app/server.py
COPY runpod/cosyvoice3/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh && \
    mkdir -p /opt/models /opt/default-voices /opt/hf-cache

WORKDIR /app
EXPOSE 80

CMD ["/app/entrypoint.sh"]
