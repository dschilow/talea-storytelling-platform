import subprocess
from flask import Flask, request, send_file
import io
import os

app = Flask(__name__)

MODEL_PATH = "/app/model.onnx"
PIPER_BINARY = "/usr/local/bin/piper_bin/piper"

@app.route('/', methods=['GET', 'POST'])
def generate_tts():
    text = request.args.get('text') or request.form.get('text')
    
    if not text:
        return "No text provided", 400

    # Ensure text is clean? Piper handles most.
    
    # Run piper process
    # echo "text" | piper -m model.onnx --output_file -
    
    try:
        proc = subprocess.Popen(
            [PIPER_BINARY, "--model", MODEL_PATH, "--output_file", "-"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        stdout, stderr = proc.communicate(input=text.encode('utf-8'))
        
        if proc.returncode != 0:
            print(f"Piper error: {stderr.decode('utf-8')}")
            return f"TTS Generation failed: {stderr.decode('utf-8')}", 500
            
        return send_file(
            io.BytesIO(stdout),
            mimetype="audio/wav",
            as_attachment=False,
            download_name="tts.wav"
        )
        
    except Exception as e:
        print(f"Server error: {e}")
        return str(e), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
