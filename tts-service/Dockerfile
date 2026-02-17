FROM python:3.11-slim

WORKDIR /app

# Install dependencies (including ffmpeg for broadcast-quality audio post-processing)
RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Piper TTS (will be replaced by binary below, but needed for initial setup)
RUN pip install piper-tts>=1.2.0

# Download Thorsten Voice Model (High Quality) — used for narration
RUN curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx?download=true" -o /app/model.onnx
RUN curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx.json?download=true" -o /app/model.onnx.json

# Download Thorsten Emotional Model (Medium Quality, 8 emotion speakers)
# Used for dialogue with emotion: amused, angry, disgusted, drunk, neutral, sleepy, surprised, whisper
RUN curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten_emotional/medium/de_DE-thorsten_emotional-medium.onnx?download=true" -o /app/emotional_model.onnx
RUN curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten_emotional/medium/de_DE-thorsten_emotional-medium.onnx.json?download=true" -o /app/emotional_model.onnx.json

# Expose port (Railway sets PORT=8080 dynamically)
EXPOSE 8080

# REVISED APPROACH: Use official binary release to ensure we have the `piper` command.
RUN pip uninstall -y piper-tts
RUN apt-get update && apt-get install -y wget tar && rm -rf /var/lib/apt/lists/*

# Download Piper binary (amd64)
RUN wget https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz \
    && tar -xvf piper_linux_x86_64.tar.gz \
    && mv piper /usr/local/bin/piper_bin \
    && rm piper_linux_x86_64.tar.gz

# Add to path
ENV PATH="/usr/local/bin/piper_bin:$PATH"

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY server.py .

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-8080} --timeout 300 --workers 1 --threads 8 server:app"]
