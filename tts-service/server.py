import subprocess
from flask import Flask, request, send_file
import io
import os
import sys

app = Flask(__name__)

# Fallback paths for local testing vs Docker
MODEL_PATH = os.environ.get('MODEL_PATH', "/app/model.onnx")
PIPER_BINARY = os.environ.get('PIPER_BINARY', "/usr/local/bin/piper_bin/piper")

# Check if model exists
if not os.path.exists(MODEL_PATH):
    print(f"WARNING: Model not found at {MODEL_PATH}", file=sys.stderr)

@app.route('/health', methods=['GET'])
def health():
    return "ok", 200

@app.route('/', methods=['GET', 'POST'])
def generate_tts():
    # Support both GET (query param) and POST (json or form)
    text = None
    if request.method == 'POST':
        if request.is_json:
            text = request.json.get('text')
        else:
            text = request.form.get('text')
    
    if not text:
        text = request.args.get('text')
    
    if not text:
        print("Error: No text provided in request", file=sys.stderr)
        return "No text provided", 400

    print(f"Received request for {len(text)} characters", file=sys.stderr)
    
    try:
        # Run piper process
        cmd = [PIPER_BINARY, "--model", MODEL_PATH, "--output_file", "-"]
        print(f"Executing: {' '.join(cmd)}", file=sys.stderr)
        
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        stdout, stderr = proc.communicate(input=text.encode('utf-8'))
        
        if proc.returncode != 0:
            error_msg = stderr.decode('utf-8')
            print(f"Piper error: {error_msg}", file=sys.stderr)
            return f"TTS Generation failed: {error_msg}", 500
            
        print(f"Successfully generated audio. Size: {len(stdout)} bytes", file=sys.stderr)
        
        return send_file(
            io.BytesIO(stdout),
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
