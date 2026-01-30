FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Piper TTS
RUN pip install piper-tts>=1.2.0

# Download Thorsten Voice Model (High Quality)
# Using direct links from huggingface as per documentation
RUN curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx?download=true" -o /app/model.onnx
RUN curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx.json?download=true" -o /app/model.onnx.json

# Expose port
EXPOSE 5000

# Run Piper HTTP server
# Note: piper-tts module might not have http_server directly exposable via -m in all versions, 
# but usually it's `python3 -m piper.http_server`. 
# If that fails, we might need to install `piper-http` or similar, but let's try standard first.
# Actually, the python package `piper-tts` is mainly the library. 
# The http server is often a separate script or part of the binary release.
# Let's use the official binary release for better reliability if the pip package is just bindings.

# REVISED APPROACH: Use official binary release to ensure we have the `piper` command and server.
RUN pip uninstall -y piper-tts
RUN apt-get update && apt-get install -y wget tar

# Download Piper binary (amd64) - Check for latest version or use a known good one
RUN wget https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz \
    && tar -xvf piper_linux_x86_64.tar.gz \
    && mv piper /usr/local/bin/piper_bin \
    && rm piper_linux_x86_64.tar.gz

# Add to path
ENV PATH="/usr/local/bin/piper_bin:$PATH"

# Install python dependencies for the http wrapper if we were to write one, 
# BUT piper has no built-in HTTP server in the binary itself (it's a CLI).
# We need a simple python http wrapper.

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY server.py .

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5000} --timeout 120 --workers 1 server:app"]
