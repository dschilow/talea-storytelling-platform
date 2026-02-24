FROM pytorch/pytorch:2.3.1-cuda12.1-cudnn8-runtime

ARG PREFETCH_MODEL=1

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_PREFER_BINARY=1 \
    HF_HOME=/opt/hf-cache \
    PYTHONPATH=/opt/cosyvoice:/opt/cosyvoice/third_party/Matcha-TTS \
    COSYVOICE_MODEL_ID=FunAudioLLM/Fun-CosyVoice3-0.5B-2512 \
    COSYVOICE_MODEL_DIR=/opt/models/Fun-CosyVoice3-0.5B-2512

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

# Install pynini via conda as per official CosyVoice docs
# (cannot be pip-installed, needs OpenFst C++ libraries)
RUN conda install -y -c conda-forge pynini==2.1.5 && conda clean -afy

WORKDIR /opt/cosyvoice
RUN git clone --recursive --depth 1 https://github.com/FunAudioLLM/CosyVoice.git /opt/cosyvoice

# Install openai-whisper first with --no-build-isolation so it uses
# the base image's setuptools (which still has pkg_resources).
# Then upgrade setuptools and install remaining requirements.
# Only filter packages that are truly unnecessary for inference:
#   - tensorrt: NVIDIA TensorRT (optional acceleration, huge size)
#   - deepspeed: training-only
#   - gradio/fastapi-cli: GUI-only
#   - grpcio/grpcio-tools: not needed for HTTP API
#   - tensorboard: training-only
#   - openai-whisper: already installed above
#   - onnxruntime extra index: use default PyPI version instead
RUN pip install --no-cache-dir --no-build-isolation openai-whisper==20231117 && \
    pip install --upgrade pip "setuptools<71" wheel cython && \
    awk ' \
      BEGIN{IGNORECASE=1} \
      /^--extra-index-url .*onnxruntime-cuda-12/ {next} \
      /^deepspeed==/ {next} \
      /^fastapi-cli==/ {next} \
      /^gradio==/ {next} \
      /^grpcio==/ {next} \
      /^grpcio-tools==/ {next} \
      /^openai-whisper==/ {next} \
      /^tensorboard==/ {next} \
      /^tensorrt-cu12==/ {next} \
      /^tensorrt-cu12-bindings==/ {next} \
      /^tensorrt-cu12-libs==/ {next} \
      {print} \
    ' requirements.txt > requirements.serverless.txt && \
    cat requirements.serverless.txt && \
    pip install --no-cache-dir -r requirements.serverless.txt && \
    pip install --no-cache-dir fastapi==0.115.6 uvicorn[standard]==0.30.0 python-multipart huggingface_hub pydub requests

# Verify ALL critical imports work at build time so we catch errors early.
# This replicates the actual import chain that happens at runtime.
RUN python -c "\
import sys; print(f'Python {sys.version}'); \
import torch; print(f'[check] torch {torch.__version__} cuda={torch.cuda.is_available()}'); \
import torchaudio; print('[check] torchaudio OK'); \
import whisper; print('[check] whisper OK'); \
import pyarrow; print('[check] pyarrow OK'); \
import lightning; print('[check] lightning OK'); \
import matplotlib; print('[check] matplotlib OK'); \
from matcha.models.components.flow_matching import BASECFM; print('[check] matcha OK'); \
from cosyvoice.cli.cosyvoice import AutoModel; print('[check] cosyvoice AutoModel OK'); \
print('[check] All imports verified successfully')"

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
