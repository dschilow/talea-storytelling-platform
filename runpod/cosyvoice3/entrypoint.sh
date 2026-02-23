#!/usr/bin/env bash
set -euo pipefail

HOST="${COSYVOICE_HOST:-0.0.0.0}"
PORT_RAW="${PORT:-${COSYVOICE_PORT:-80}}"
HEALTH_PORT_RAW="${PORT_HEALTH:-${PORT_RAW}}"

if [[ "${PORT_RAW}" =~ ^[0-9]+$ ]]; then
  PORT="${PORT_RAW}"
else
  echo "[start] Invalid PORT='${PORT_RAW}', fallback to 80"
  PORT="80"
fi

export COSYVOICE_HOST="${HOST}"
export COSYVOICE_PORT="${PORT}"
export PORT="${PORT}"

echo "[start] CosyVoice API starting on ${HOST}:${PORT} (PORT_HEALTH=${HEALTH_PORT_RAW})"
exec python /app/server.py
