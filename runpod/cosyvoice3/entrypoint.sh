#!/usr/bin/env bash
set -euo pipefail

HOST="${COSYVOICE_HOST:-0.0.0.0}"
PORT="${PORT:-${COSYVOICE_PORT:-80}}"

echo "[start] CosyVoice API starting on ${HOST}:${PORT}"
exec python /app/server.py --host "${HOST}" --port "${PORT}"
