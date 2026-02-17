import subprocess
from flask import Flask, request, send_file, jsonify
from concurrent.futures import ThreadPoolExecutor, as_completed
import io
import os
import sys
import struct
import time
import re
import base64
import uuid
import threading

# Number of parallel Piper processes per request
MAX_PARALLEL_PIPER = int(os.environ.get('MAX_PARALLEL_PIPER', '4'))

app = Flask(__name__)

# Fallback paths for local testing vs Docker
MODEL_PATH = os.environ.get('MODEL_PATH', "/app/model.onnx")
PIPER_BINARY = os.environ.get('PIPER_BINARY', "/usr/local/bin/piper_bin/piper")

# Max characters per chunk - keeps each Piper call fast
MAX_CHUNK_CHARS = 300

# ── Async job registry ────────────────────────────────────────────────────────
# Stores: { job_id: { "status": "processing"|"ready"|"error", "result": bytes|None, "error": str|None, "created": float } }
_jobs: dict = {}
_jobs_lock = threading.Lock()

# Background thread pool for async job processing (separate from per-request parallelism)
_job_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="tts-job")

# TTL for completed jobs: 10 minutes (client has time to fetch the result)
JOB_TTL_SECONDS = 600

# Check if model exists
if not os.path.exists(MODEL_PATH):
    print(f"WARNING: Model not found at {MODEL_PATH}", file=sys.stderr)

def preprocess_text(text):
    """Normalize text for better TTS pronunciation."""
    # ── Abbreviations ──
    text = re.sub(r'\bz\.B\.\b', 'zum Beispiel', text)
    text = re.sub(r'\bd\.h\.\b', 'das heißt', text)
    text = re.sub(r'\bu\.a\.\b', 'unter anderem', text)
    text = re.sub(r'\bbzw\.\b', 'beziehungsweise', text)
    text = re.sub(r'\busw\.\b', 'und so weiter', text)
    text = re.sub(r'\bu\.s\.w\.\b', 'und so weiter', text)
    text = re.sub(r'\bca\.\b', 'circa', text)
    text = re.sub(r'\bDr\.\b', 'Doktor', text)
    text = re.sub(r'\bProf\.\b', 'Professor', text)
    text = re.sub(r'\bHr\.\b', 'Herr', text)
    text = re.sub(r'\bFr\.\b', 'Frau', text)
    text = re.sub(r'\bNr\.\b', 'Nummer', text)
    text = re.sub(r'\bSt\.\b', 'Sankt', text)
    text = re.sub(r'\bStr\.\b', 'Straße', text)
    text = re.sub(r'\bo\.ä\.\b', 'oder ähnliches', text)
    text = re.sub(r'\bs\.o\.\b', 'siehe oben', text)
    text = re.sub(r'\bggf\.\b', 'gegebenenfalls', text)
    text = re.sub(r'\bevtl\.\b', 'eventuell', text)
    text = re.sub(r'\bMio\.\b', 'Millionen', text)
    text = re.sub(r'\bMrd\.\b', 'Milliarden', text)
    # ── Time expressions: 14:30 → vierzehn Uhr dreißig ──
    def time_to_german(m):
        h = int(m.group(1))
        mins = int(m.group(2))
        result = number_to_german(h) + ' Uhr'
        if mins > 0:
            result += ' ' + number_to_german(mins)
        return result
    text = re.sub(r'\b(\d{1,2}):(\d{2})\b', time_to_german, text)
    # ── Normalize German quotation marks to ASCII for consistent handling ──
    text = text.replace('\u201e', '"')   # „ → "
    text = text.replace('\u201c', '"')   # " → "
    text = text.replace('\u201d', '"')   # " → "
    text = text.replace('\u00bb', '"')   # » → "
    text = text.replace('\u00ab', '"')   # « → "
    text = text.replace('\u203a', '"')   # › → "
    text = text.replace('\u2039', '"')   # ‹ → "
    # ── Remove markdown artifacts ──
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'#{1,6}\s*', '', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # ── Scene transition markers → pause ──
    text = re.sub(r'^[\*\-]{3,}\s*$', '...', re.MULTILINE)
    # ── Normalize dashes ──
    text = text.replace('\u2014', ', ')  # em-dash
    text = text.replace('\u2013', ', ')  # en-dash
    # ── Whitespace cleanup ──
    text = re.sub(r'\n+', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()

def prepare_for_tts(text):
    """
    Transform story text into a format that Piper TTS reads more naturally.
    Adds micro-pauses via punctuation, expands difficult words, slows dialogue.
    The original text in the frontend stays unchanged — this only affects audio.
    """
    # ── 1. Paragraph breaks → sentence-ending pause ──
    # Piper ignores \n\n. Replace with period + newline so it creates a real pause.
    # Do this FIRST so later rules operate on clean text.
    text = re.sub(r'\n\n+', '.\n\n', text)
    # Clean up double periods (but preserve intentional ellipses)
    text = re.sub(r'\.{2}(?!\.)', '.', text)

    # ── 2. Dialogue pauses: breathing room around quoted speech ──
    # Insert pause before opening quote when preceded by sentence-ending punctuation
    text = re.sub(r'([.!?])\s*"', r'\1 ... "', text)
    # Pause after closing quote before speech attribution verbs
    attribution_verbs = (
        'sagte|rief|flüsterte|fragte|antwortete|meinte|murmelte|schrie|lachte|'
        'erklärte|bat|dachte|brummte|seufzte|stöhnte|jubelte|wisperte|knurrte|'
        'hauchte|schluchzte|jammerte|staunte|schnaubte|zischte|sang|brüllte'
    )
    text = re.sub(
        r'([.!?])"\s*,?\s*(' + attribution_verbs + r')',
        r'\1" ... \2', text
    )
    # Pause before opening quote when starting speech mid-narration
    text = re.sub(r'(\w{3,}):\s*"', r'\1: ... "', text)

    # ── 3. Exclamation/question emphasis ──
    text = re.sub(r'!\s', '!! ', text)
    text = re.sub(r'\?\s', '?? ', text)

    # ── 4. Comma breathing: add commas at natural breath points ──
    # Before subordinate conjunctions
    text = re.sub(
        r'(\w{4,})\s+(wenn|als|weil|dass|aber|doch|denn|obwohl|damit|bevor|nachdem|während|sobald|ob|falls|solange)\s',
        r'\1, \2 ', text
    )
    # Before "und" / "oder" in longer clauses (only when preceded by 6+ chars to avoid short phrases)
    text = re.sub(r'(\w{6,})\s+(und|oder)\s+(\w{4,})', r'\1, \2 \3', text)

    # ── 5. Interjection pauses ──
    # Common German interjections get a micro-pause after them
    interjections = (
        'Ach|Oh|Ah|Ooh|Wow|Hey|Hm|Hmm|Na|Naja|Tja|Aha|Ohje|Hoppla|'
        'Hurra|Ups|Autsch|Aua|Igitt|Pfui|Juhu|Oje|Mensch|Mist|Donnerwetter'
    )
    text = re.sub(r'\b(' + interjections + r')([,!]?\s)', r'\1, ... ', text)

    # ── 6. Number pronunciation ──
    text = re.sub(r'\b(\d+)\b', lambda m: number_to_german(int(m.group(1))), text)

    # ── 7. Onomatopoeia emphasis: stretch sound words for kids ──
    sound_words = {
        'Platsch': 'Plaatsch', 'platsch': 'plaatsch',
        'Bumm': 'Buumm', 'bumm': 'buumm',
        'Puff': 'Puuff', 'puff': 'puuff',
        'Knall': 'Knaall', 'knall': 'knaall',
        'Zisch': 'Ziisch', 'zisch': 'ziisch',
        'Klopf': 'Kloopf', 'klopf': 'kloopf',
        'Plopp': 'Ploopp', 'plopp': 'ploopp',
        'Krach': 'Kraach', 'krach': 'kraach',
        'Huiii': 'Huuiii',
        'Pssst': 'Psssst',
        'Huch': 'Huuch', 'huch': 'huuch',
        'Wusch': 'Wuusch', 'wusch': 'wuusch',
        'Schwupp': 'Schwuupp', 'schwupp': 'schwuupp',
        'Rums': 'Ruums', 'rums': 'ruums',
        'Piep': 'Pieep', 'piep': 'pieep',
        'Miau': 'Miaauu', 'miau': 'miaauu',
        'Wuff': 'Wuuff', 'wuff': 'wuuff',
        'Brumm': 'Bruumm', 'brumm': 'bruumm',
        'Ratsch': 'Raatsch', 'ratsch': 'raatsch',
        'Klirr': 'Kliirr', 'klirr': 'kliirr',
        'Kling': 'Kliing', 'kling': 'kliing',
        'Dong': 'Doong', 'dong': 'doong',
        'Tock': 'Toock', 'tock': 'toock',
        'Tick': 'Tiick', 'tick': 'tiick',
    }
    for word, replacement in sound_words.items():
        text = re.sub(r'\b' + re.escape(word) + r'\b', replacement, text)

    # ── 8. Trailing ellipsis for suspense sentences ──
    # "Er öffnete die Tür." at end of paragraph → add slight suspense if followed by paragraph break
    text = re.sub(r'([.])(\n\n)', r'\1 ...\2', text)

    # ── 9. Clean up artifacts ──
    text = re.sub(r',\s*,', ',', text)
    text = re.sub(r'\.\s*,', '.', text)
    text = re.sub(r',\s*\.', '.', text)
    text = re.sub(r'\.{4,}', '...', text)   # normalize 4+ dots to 3
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\s+([.!?,])', r'\1', text)  # no space before punctuation

    return text.strip()

def number_to_german(n):
    """Convert small numbers to German words for natural TTS reading."""
    if n < 0 or n > 9999:
        return str(n)
    words = {
        0: 'null', 1: 'eins', 2: 'zwei', 3: 'drei', 4: 'vier',
        5: 'fünf', 6: 'sechs', 7: 'sieben', 8: 'acht', 9: 'neun',
        10: 'zehn', 11: 'elf', 12: 'zwölf', 13: 'dreizehn', 14: 'vierzehn',
        15: 'fünfzehn', 16: 'sechzehn', 17: 'siebzehn', 18: 'achtzehn',
        19: 'neunzehn', 20: 'zwanzig', 30: 'dreißig', 40: 'vierzig',
        50: 'fünfzig', 60: 'sechzig', 70: 'siebzig', 80: 'achtzig',
        90: 'neunzig', 100: 'hundert',
    }
    if n in words:
        return words[n]
    if n < 100:
        tens = (n // 10) * 10
        ones = n % 10
        if ones == 0:
            return words.get(tens, str(n))
        if ones == 1:
            return f'einund{words[tens]}'
        return f'{words.get(ones, str(ones))}und{words.get(tens, str(tens))}'
    if n < 1000:
        hundreds = n // 100
        rest = n % 100
        prefix = words.get(hundreds, str(hundreds)) + 'hundert'
        if rest == 0:
            return prefix
        return prefix + number_to_german(rest)
    if n < 10000:
        thousands = n // 1000
        rest = n % 1000
        prefix = words.get(thousands, str(thousands)) + 'tausend'
        if rest == 0:
            return prefix
        return prefix + number_to_german(rest)
    return str(n)

def generate_silence(duration_ms, sample_rate=22050, bits_per_sample=16, num_channels=1):
    """Generate a WAV chunk of silence."""
    num_samples = int(sample_rate * duration_ms / 1000)
    byte_rate = sample_rate * num_channels * (bits_per_sample // 8)
    block_align = num_channels * (bits_per_sample // 8)
    data_size = num_samples * block_align
    silence = b'\x00' * data_size
    header = struct.pack('<4sI4s', b'RIFF', 36 + data_size, b'WAVE')
    fmt_chunk = struct.pack('<4sIHHIIHH', b'fmt ', 16, 1, num_channels,
                           sample_rate, byte_rate, block_align, bits_per_sample)
    data_header = struct.pack('<4sI', b'data', data_size)
    return header + fmt_chunk + data_header + silence

def split_text_into_chunks(text, max_chars=MAX_CHUNK_CHARS):
    """
    Split text into chunks optimized for Piper TTS.
    - Paragraphs get their own chunks (natural pauses between them)
    - Dialogue lines split separately so Piper can voice them distinctly
    - Never split mid-sentence
    """
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

            # If this sentence contains dialogue, give it breathing room
            has_dialogue = '"' in sentence or '„' in sentence or '»' in sentence

            # Start a new chunk if:
            # 1. Adding this sentence exceeds max_chars, OR
            # 2. This is a dialogue line and current chunk is narration (or vice versa)
            if current_chunk:
                would_exceed = len(current_chunk) + len(sentence) + 1 > max_chars
                current_has_dialogue = '"' in current_chunk or '„' in current_chunk or '»' in current_chunk

                # Split at dialogue/narration boundary for cleaner voice transitions
                dialogue_boundary = has_dialogue != current_has_dialogue and len(current_chunk) > 60

                if would_exceed or dialogue_boundary:
                    chunks.append(current_chunk.strip())
                    current_chunk = sentence
                else:
                    current_chunk = (current_chunk + " " + sentence).strip()
            else:
                current_chunk = sentence

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

def _get_silence_between(chunk_a, chunk_b):
    """Determine silence duration between two chunks based on content."""
    has_dialogue_a = '"' in chunk_a
    has_dialogue_b = '"' in chunk_b

    # Scene/paragraph boundary: longer pause
    if chunk_a.rstrip().endswith('...'):
        return generate_silence(600)

    # Dialogue → narration or narration → dialogue transition
    if has_dialogue_a != has_dialogue_b:
        return generate_silence(450)

    # After exclamatory chunks
    if chunk_a.rstrip().endswith(('!!', '??')):
        return generate_silence(400)

    # Default: natural sentence boundary pause
    return generate_silence(320)

def _do_generate(text, length_scale, noise_scale, noise_w):
    """Core generation logic — called synchronously or in a job thread."""
    text = preprocess_text(text)
    text = prepare_for_tts(text)

    chunks = split_text_into_chunks(text)
    print(f"Split into {len(chunks)} chunks", file=sys.stderr)

    wav_results = [None] * len(chunks)
    workers = min(MAX_PARALLEL_PIPER, len(chunks))

    if workers <= 1:
        wav_results[0] = generate_wav_chunk(chunks[0], length_scale, noise_scale, noise_w)
    else:
        def gen_chunk(idx):
            cs = time.time()
            data = generate_wav_chunk(chunks[idx], length_scale, noise_scale, noise_w)
            ct = time.time() - cs
            print(f"  Chunk {idx+1}/{len(chunks)}: {len(chunks[idx])} chars -> {len(data)} bytes ({ct:.1f}s)", file=sys.stderr)
            return idx, data

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(gen_chunk, i) for i in range(len(chunks))]
            for future in as_completed(futures):
                idx, data = future.result()
                wav_results[idx] = data

    wav_chunks = []
    for i, wav_data in enumerate(wav_results):
        wav_chunks.append(wav_data)
        if i < len(wav_results) - 1:
            silence = _get_silence_between(chunks[i], chunks[i + 1])
            wav_chunks.append(silence)

    return concatenate_wav(wav_chunks)

def _purge_old_jobs():
    """Remove jobs older than JOB_TTL_SECONDS."""
    now = time.time()
    with _jobs_lock:
        expired = [jid for jid, j in _jobs.items() if now - j['created'] > JOB_TTL_SECONDS]
        for jid in expired:
            del _jobs[jid]
    if expired:
        print(f"Purged {len(expired)} expired jobs", file=sys.stderr)

@app.route('/health', methods=['GET'])
def health():
    return "ok", 200

# ── Async job endpoints ───────────────────────────────────────────────────────

@app.route('/generate/async', methods=['POST'])
def generate_async():
    """
    Submit a TTS generation job. Returns immediately with a job_id.
    The actual generation runs in the background.

    Request: { "text": "...", "length_scale": 1.55, "noise_scale": 0.42, "noise_w": 0.38 }
    Response: { "job_id": "uuid" }
    """
    if not request.is_json:
        return "JSON body required", 400

    data = request.json
    text = data.get('text', '')
    if not text:
        return "No text provided", 400

    length_scale = float(data.get('length_scale', 1.0))
    noise_scale = float(data.get('noise_scale', 0.667))
    noise_w = float(data.get('noise_w', 0.8))

    _purge_old_jobs()

    job_id = str(uuid.uuid4())
    with _jobs_lock:
        _jobs[job_id] = {
            'status': 'processing',
            'result': None,
            'error': None,
            'created': time.time(),
        }

    print(f"Job {job_id}: queued (text len={len(text)})", file=sys.stderr)

    def run_job():
        start = time.time()
        try:
            result = _do_generate(text, length_scale, noise_scale, noise_w)
            elapsed = time.time() - start
            print(f"Job {job_id}: ready ({len(result)} bytes, {elapsed:.1f}s)", file=sys.stderr)
            with _jobs_lock:
                if job_id in _jobs:
                    _jobs[job_id]['status'] = 'ready'
                    _jobs[job_id]['result'] = result
        except Exception as e:
            elapsed = time.time() - start
            print(f"Job {job_id}: error after {elapsed:.1f}s: {e}", file=sys.stderr)
            with _jobs_lock:
                if job_id in _jobs:
                    _jobs[job_id]['status'] = 'error'
                    _jobs[job_id]['error'] = str(e)

    _job_executor.submit(run_job)

    return jsonify({'job_id': job_id}), 202


@app.route('/generate/status/<job_id>', methods=['GET'])
def generate_status(job_id):
    """
    Poll job status.
    Response: { "status": "processing" | "ready" | "error", "error": null | "message" }
    """
    with _jobs_lock:
        job = _jobs.get(job_id)

    if job is None:
        return jsonify({'status': 'not_found'}), 404

    return jsonify({
        'status': job['status'],
        'error': job.get('error'),
    }), 200


@app.route('/generate/result/<job_id>', methods=['GET'])
def generate_result(job_id):
    """
    Fetch completed job result as WAV audio.
    Returns 202 if still processing, 200 with audio/wav if ready, 500 if error.
    """
    with _jobs_lock:
        job = _jobs.get(job_id)

    if job is None:
        return jsonify({'error': 'job not found'}), 404

    if job['status'] == 'processing':
        return jsonify({'status': 'processing'}), 202

    if job['status'] == 'error':
        return jsonify({'error': job.get('error', 'unknown error')}), 500

    # Ready — serve audio and clean up job
    result_bytes = job['result']
    with _jobs_lock:
        _jobs.pop(job_id, None)

    return send_file(
        io.BytesIO(result_bytes),
        mimetype="audio/wav",
        as_attachment=False,
        download_name="tts.wav"
    )

# ── Legacy synchronous endpoints (kept for backward compatibility) ─────────────

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
            if request.form.get('length_scale'):
                length_scale = float(request.form.get('length_scale'))
            if request.form.get('noise_scale'):
                noise_scale = float(request.form.get('noise_scale'))
            if request.form.get('noise_w'):
                noise_w = float(request.form.get('noise_w'))

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

    print(f"Sync request: len={len(text)}, speed={length_scale}, noise={noise_scale}, noise_w={noise_w}", file=sys.stderr)
    start_time = time.time()

    try:
        result = _do_generate(text, length_scale, noise_scale, noise_w)
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

@app.route('/batch', methods=['POST'])
def generate_tts_batch():
    """
    Batch endpoint: generate multiple TTS items in parallel.
    Request: { "items": [{ "id": "chunk-1", "text": "..." }, ...], "length_scale": 1.55, ... }
    Response: { "results": [{ "id": "chunk-1", "audio": "base64...", "error": null }, ...] }
    """
    if not request.is_json:
        return "JSON body required", 400

    data = request.json
    items = data.get('items', [])
    if not items:
        return jsonify({"results": []}), 200

    length_scale = float(data.get('length_scale', 1.0))
    noise_scale = float(data.get('noise_scale', 0.667))
    noise_w = float(data.get('noise_w', 0.8))

    print(f"Batch request: {len(items)} items, speed={length_scale}", file=sys.stderr)
    start_time = time.time()

    def process_item(item):
        item_id = item.get('id', 'unknown')
        text = item.get('text', '')
        if not text:
            return {"id": item_id, "audio": None, "error": "No text"}
        try:
            text = preprocess_text(text)
            text = prepare_for_tts(text)
            chunks = split_text_into_chunks(text)
            silence_gap = generate_silence(380) if len(chunks) > 1 else None

            wav_chunks = []
            for i, chunk in enumerate(chunks):
                wav_data = generate_wav_chunk(chunk, length_scale, noise_scale, noise_w)
                wav_chunks.append(wav_data)
                if silence_gap and i < len(chunks) - 1:
                    wav_chunks.append(silence_gap)

            result_wav = concatenate_wav(wav_chunks)
            audio_b64 = base64.b64encode(result_wav).decode('ascii')
            return {"id": item_id, "audio": f"data:audio/wav;base64,{audio_b64}", "error": None}
        except Exception as e:
            print(f"Batch item {item_id} error: {e}", file=sys.stderr)
            return {"id": item_id, "audio": None, "error": str(e)}

    # Process all items in parallel
    workers = min(MAX_PARALLEL_PIPER, len(items))
    results = [None] * len(items)

    if workers <= 1:
        results[0] = process_item(items[0])
    else:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(process_item, items[i]): i for i in range(len(items))}
            for future in as_completed(futures):
                idx = futures[future]
                results[idx] = future.result()

    total_time = time.time() - start_time
    ok_count = sum(1 for r in results if r and r.get('audio'))
    print(f"Batch done: {ok_count}/{len(items)} ok, {total_time:.1f}s ({workers} workers)", file=sys.stderr)

    return jsonify({"results": results}), 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting TTS Server on port {port}...", file=sys.stderr)
    app.run(host='0.0.0.0', port=port)
