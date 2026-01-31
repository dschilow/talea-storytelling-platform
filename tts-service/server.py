import subprocess
from flask import Flask, request, send_file
import io
import os
import sys
import struct
import time
import re

app = Flask(__name__)

# Fallback paths for local testing vs Docker
MODEL_PATH = os.environ.get('MODEL_PATH', "/app/model.onnx")
PIPER_BINARY = os.environ.get('PIPER_BINARY', "/usr/local/bin/piper_bin/piper")

# Max characters per chunk - keeps each Piper call fast
MAX_CHUNK_CHARS = 300

# Check if model exists
if not os.path.exists(MODEL_PATH):
    print(f"WARNING: Model not found at {MODEL_PATH}", file=sys.stderr)

def split_text_into_chunks(text, max_chars=MAX_CHUNK_CHARS):
    """Split text into chunks at sentence boundaries, respecting max_chars."""
    # Split by paragraphs first
    paragraphs = text.split('\n\n')
    chunks = []

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(para) <= max_chars:
            chunks.append(para)
            continue

        # Split paragraph into sentences
        sentences = re.split(r'(?<=[.!?])\s+', para)
        current_chunk = ""

        for sentence in sentences:
            if not sentence.strip():
                continue
            if current_chunk and len(current_chunk) + len(sentence) + 1 > max_chars:
                chunks.append(current_chunk.strip())
                current_chunk = sentence
            else:
                current_chunk = (current_chunk + " " + sentence).strip()

        if current_chunk.strip():
            chunks.append(current_chunk.strip())

    return chunks

def generate_wav_chunk(text, length_scale=1.0, noise_scale=0.667, noise_w=0.8):
    """Generate WAV audio for a single text chunk using Piper."""
    cmd = [
        PIPER_BINARY,
        "--model", MODEL_PATH,
        "--output_file", "-",
        "--length_scale", str(length_scale),
        "--noise_scale", str(noise_scale),
        "--noise_w", str(noise_w)
    ]

    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    stdout, stderr = proc.communicate(input=text.encode('utf-8'))

    if proc.returncode != 0:
        error_msg = stderr.decode('utf-8')
        raise RuntimeError(f"Piper error: {error_msg}")

    return stdout

def concatenate_wav(wav_chunks):
    """Concatenate multiple WAV byte arrays into a single WAV file."""
    if len(wav_chunks) == 1:
        return wav_chunks[0]

    all_audio_data = []
    sample_rate = None
    num_channels = None
    bits_per_sample = None

    for wav_bytes in wav_chunks:
        if len(wav_bytes) < 44:
            continue

        # Parse WAV header (44 bytes for standard PCM WAV)
        # Bytes 22-23: num channels
        # Bytes 24-27: sample rate
        # Bytes 34-35: bits per sample
        # Bytes 36-39: "data"
        # Bytes 40-43: data size
        channels = struct.unpack_from('<H', wav_bytes, 22)[0]
        rate = struct.unpack_from('<I', wav_bytes, 24)[0]
        bps = struct.unpack_from('<H', wav_bytes, 34)[0]

        if sample_rate is None:
            sample_rate = rate
            num_channels = channels
            bits_per_sample = bps

        # Find the data chunk - search for "data" marker
        data_offset = wav_bytes.find(b'data')
        if data_offset == -1:
            continue
        data_size = struct.unpack_from('<I', wav_bytes, data_offset + 4)[0]
        audio_start = data_offset + 8
        all_audio_data.append(wav_bytes[audio_start:audio_start + data_size])

    if not all_audio_data:
        return wav_chunks[0] if wav_chunks else b''

    # Combine all audio data
    combined_data = b''.join(all_audio_data)
    total_data_size = len(combined_data)

    # Build new WAV file
    byte_rate = sample_rate * num_channels * (bits_per_sample // 8)
    block_align = num_channels * (bits_per_sample // 8)

    header = struct.pack('<4sI4s', b'RIFF', 36 + total_data_size, b'WAVE')
    fmt_chunk = struct.pack('<4sIHHIIHH', b'fmt ', 16, 1, num_channels,
                           sample_rate, byte_rate, block_align, bits_per_sample)
    data_header = struct.pack('<4sI', b'data', total_data_size)

    return header + fmt_chunk + data_header + combined_data

@app.route('/health', methods=['GET'])
def health():
    return "ok", 200

@app.route('/', methods=['GET', 'POST'])
def generate_tts():
    # Support both GET (query param) and POST (json or form)
    text = None
    length_scale = 1.0
    noise_scale = 0.667
    noise_w = 0.8

    if request.method == 'POST':
        if request.is_json:
            data = request.json
            text = data.get('text')
            length_scale = float(data.get('length_scale', 1.0))
            noise_scale = float(data.get('noise_scale', 0.667))
            noise_w = float(data.get('noise_w', 0.8))
        else:
            text = request.form.get('text')
            # form handling for params if needed, but JSON is main use case

    if not text:
        text = request.args.get('text')
        # query params also possible
        if request.args.get('length_scale'):
            length_scale = float(request.args.get('length_scale'))
        if request.args.get('noise_scale'):
            noise_scale = float(request.args.get('noise_scale'))
        if request.args.get('noise_w'):
            noise_w = float(request.args.get('noise_w'))

    if not text:
        print("Error: No text provided in request", file=sys.stderr)
        return "No text provided", 400

    print(f"Request: len={len(text)}, speed={length_scale}, noise={noise_scale}, noise_w={noise_w}", file=sys.stderr)
    start_time = time.time()

    try:
        chunks = split_text_into_chunks(text)
        print(f"Split into {len(chunks)} chunks", file=sys.stderr)

        wav_chunks = []
        for i, chunk in enumerate(chunks):
            chunk_start = time.time()
            wav_data = generate_wav_chunk(chunk, length_scale, noise_scale, noise_w)
            chunk_time = time.time() - chunk_start
            print(f"  Chunk {i+1}/{len(chunks)}: {len(chunk)} chars -> {len(wav_data)} bytes ({chunk_time:.1f}s)", file=sys.stderr)
            wav_chunks.append(wav_data)

        result = concatenate_wav(wav_chunks)
        total_time = time.time() - start_time
        print(f"Successfully generated audio. Size: {len(result)} bytes, Total time: {total_time:.1f}s", file=sys.stderr)

        return send_file(
            io.BytesIO(result),
            mimetype="audio/wav",
            as_attachment=False,
            download_name="tts.wav"
        )

    except Exception as e:
        print(f"Server exception: {e}", file=sys.stderr)
        return str(e), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting TTS Server on port {port}...", file=sys.stderr)
    app.run(host='0.0.0.0', port=port)
