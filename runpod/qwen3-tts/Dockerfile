FROM pytorch/pytorch:2.3.1-cuda12.1-cudnn8-runtime

ARG PREFETCH_MODEL=0

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_PREFER_BINARY=1 \
    HF_HOME=/opt/hf-cache

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    git-lfs \
    ffmpeg \
    sox \
    libsox-dev \
    libsndfile1 \
    ca-certificates \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --upgrade pip "setuptools<71" wheel && \
    pip install --no-cache-dir \
    torch torchvision torchaudio \
    transformers \
    accelerate \
    deepspeed \
    peft \
    modelscope \
    huggingface_hub \
    soundfile \
    librosa \
    pydub \
    runpod \
    fastapi==0.115.6 \
    uvicorn[standard]==0.30.0 \
    python-multipart \
    sentencepiece

# Optional: Install flash-attn if supported by the model
# RUN pip install flash-attn --no-build-isolation

RUN python -c "\
import sys; print(f'Python {sys.version}'); \
import torch; print(f'[check] torch {torch.__version__} cuda={torch.cuda.is_available()}'); \
import torchaudio; print('[check] torchaudio OK'); \
import transformers; print(f'[check] transformers {transformers.__version__}'); \
print('[check] All basics verified successfully')"

# This will pre-download the model at image build time if PREFETCH_MODEL=1
RUN if [ "$PREFETCH_MODEL" = "1" ]; then \
      python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='Qwen/Qwen3-TTS-12Hz-0.6B', local_dir='/opt/models/Qwen3-TTS', local_dir_use_symlinks=False, resume_download=True)"; \
    else \
      echo "Skipping model prefetch during build (PREFETCH_MODEL=$PREFETCH_MODEL). Will download on first run."; \
    fi

COPY server.py queue_worker.py /app/

CMD ["python", "-u", "/app/queue_worker.py"]
