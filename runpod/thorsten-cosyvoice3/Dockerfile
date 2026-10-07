FROM pytorch/pytorch:2.3.1-cuda12.1-cudnn8-runtime

# Commit the Thorsten fine-tune was trained and tested against (see model card)
ARG COSYVOICE_COMMIT=ace7c47
# 1 = bake the ~5 GB of weights into the image (faster cold starts, bigger image)
ARG PREFETCH_MODEL=0

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_PREFER_BINARY=1 \
    HF_HOME=/opt/hf-cache \
    PYTHONPATH=/opt/cosyvoice:/opt/cosyvoice/third_party/Matcha-TTS:/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ffmpeg \
    sox \
    libsox-dev \
    libsndfile1 \
    ca-certificates \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/FunAudioLLM/CosyVoice.git /opt/cosyvoice && \
    cd /opt/cosyvoice && \
    git checkout "$COSYVOICE_COMMIT" && \
    git submodule update --init --recursive

# Inference only: drop training, GUI and TensorRT packages from the upstream requirements
WORKDIR /opt/cosyvoice
RUN pip install --no-build-isolation openai-whisper==20231117 && \
    pip install --upgrade pip "setuptools<71" wheel cython && \
    grep -viE '^(deepspeed|fastapi-cli|gradio|grpcio|grpcio-tools|openai-whisper|tensorboard|tensorrt-cu12[a-z-]*)==' requirements.txt > requirements.inference.txt && \
    pip install -r requirements.inference.txt && \
    pip install flask==3.0.3 runpod num2words==0.5.13 huggingface_hub

RUN python -c "from cosyvoice.cli.cosyvoice import CosyVoice3; import runpod, flask, num2words; print('imports ok')"

COPY tts-thorsten-kokoro-service/textprep.py tts-thorsten-kokoro-service/audioprep.py runpod/thorsten-cosyvoice3/worker.py /app/

RUN if [ "$PREFETCH_MODEL" = "1" ]; then \
      python -c "import worker; worker.ensure_model('/opt/models/thorsten-cosyvoice3')"; \
    fi

WORKDIR /app
EXPOSE 80

CMD ["python", "/app/worker.py"]
