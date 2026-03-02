ARG PYTORCH_BASE_IMAGE=pytorch/pytorch:2.5.1-cuda12.4-cudnn9-devel
FROM ${PYTORCH_BASE_IMAGE}

ARG PREFETCH_MODEL=0
ARG INSTALL_FLASH_ATTN=1
ARG ENFORCE_FLASH_ATTN=1
ARG FLASH_ATTN_VERSION=2.8.3
ARG MAX_JOBS=8

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_PREFER_BINARY=1 \
    HF_HOME=/opt/hf-cache \
    MAX_JOBS=${MAX_JOBS} \
    TORCH_CUDA_ARCH_LIST="8.0;8.6;8.9;9.0"

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    git-lfs \
    ffmpeg \
    sox \
    libsox-dev \
    libsndfile1 \
    ca-certificates \
    build-essential \
    ninja-build \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --upgrade pip "setuptools<71" wheel && \
    pip install --no-cache-dir \
    transformers \
    accelerate \
    huggingface_hub \
    soundfile \
    librosa \
    pydub \
    runpod \
    fastapi==0.115.6 \
    uvicorn[standard]==0.30.0 \
    python-multipart \
    sentencepiece \
    qwen-tts

# Optional: Try to install flash-attn. On runtime images (no nvcc), this may fail.
# Set ENFORCE_FLASH_ATTN=1 to fail the build when flash-attn is unavailable.
RUN if [ "$INSTALL_FLASH_ATTN" = "1" ]; then \
      echo "Attempting flash-attn install (version=${FLASH_ATTN_VERSION})..."; \
      pip install --no-cache-dir ninja packaging; \
      if pip install --no-cache-dir "flash-attn==${FLASH_ATTN_VERSION}" --no-build-isolation; then \
        echo "flash-attn installed successfully."; \
      else \
        echo "flash-attn install failed."; \
        if [ "$ENFORCE_FLASH_ATTN" = "1" ]; then \
          echo "ENFORCE_FLASH_ATTN=1, failing build."; \
          exit 1; \
        fi; \
        echo "Continuing without flash-attn."; \
      fi; \
    else \
      echo "Skipping flash-attn install (INSTALL_FLASH_ATTN=$INSTALL_FLASH_ATTN)"; \
    fi

RUN python -c "\
import sys; print(f'Python {sys.version}'); \
import torch; print(f'[check] torch {torch.__version__} cuda={torch.cuda.is_available()}'); \
import torchaudio; print('[check] torchaudio OK'); \
import transformers; print(f'[check] transformers {transformers.__version__}'); \
import importlib.util; print(f'[check] flash_attn_installed={importlib.util.find_spec(\"flash_attn\") is not None}'); \
print('[check] All basics verified successfully')"

RUN if [ "$ENFORCE_FLASH_ATTN" = "1" ]; then \
      python -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('flash_attn') else 1)"; \
    fi

# This will pre-download the model at image build time if PREFETCH_MODEL=1
RUN if [ "$PREFETCH_MODEL" = "1" ]; then \
      python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice', local_dir='/opt/models/Qwen3-TTS-CustomVoice', local_dir_use_symlinks=False, resume_download=True)"; \
      python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='Qwen/Qwen3-TTS-Tokenizer-12Hz', local_dir='/opt/models/Qwen3-TTS-Tokenizer-12Hz', local_dir_use_symlinks=False, resume_download=True)"; \
    else \
      echo "Skipping model prefetch during build (PREFETCH_MODEL=$PREFETCH_MODEL). Will download on first run."; \
    fi

COPY server.py queue_worker.py /app/

CMD ["python", "-u", "/app/queue_worker.py"]
