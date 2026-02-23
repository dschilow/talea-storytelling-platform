#!/usr/bin/env bash
set -euo pipefail

HOST="${COSYVOICE_HOST:-0.0.0.0}"
PORT_RAW="${PORT:-${COSYVOICE_PORT:-80}}"

if [[ "${PORT_RAW}" =~ ^[0-9]+$ ]]; then
  PORT="${PORT_RAW}"
else
  echo "[start] Invalid PORT='${PORT_RAW}', fallback to 80"
  PORT="80"
fi

export COSYVOICE_HOST="${HOST}"
export PORT="${PORT}"

echo "[start] CosyVoice API starting on ${HOST}:${PORT}"
exec python /app/server.py
