FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/opt/hf-cache \
    COSYVOICE_MODEL_ID=FunAudioLLM/CosyVoice-300M-25Hz \
    COSYVOICE_MODEL_DIR=/opt/models/CosyVoice-300M-25Hz \
    COSYVOICE_PORT=80

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    git \
    ffmpeg \
    sox \
    libsndfile1 \
    ca-certificates \
    build-essential \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && ln -sf /usr/bin/pip3 /usr/bin/pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/cosyvoice
RUN git clone --depth 1 https://github.com/FunAudioLLM/CosyVoice.git /opt/cosyvoice

RUN pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu124 && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir . && \
    pip install --no-cache-dir fastapi uvicorn[standard] python-multipart huggingface_hub pydub requests

# Prefetch model into image to reduce cold-start latency.
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='FunAudioLLM/CosyVoice-300M-25Hz', local_dir='/opt/models/CosyVoice-300M-25Hz', local_dir_use_symlinks=False, resume_download=True)"

COPY runpod/cosyvoice3/server.py /app/server.py
COPY runpod/cosyvoice3/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh && \
    mkdir -p /opt/models /opt/default-voices /opt/hf-cache

WORKDIR /app
EXPOSE 80

CMD ["/app/entrypoint.sh"]

