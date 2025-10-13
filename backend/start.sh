#!/bin/bash
set -euo pipefail

echo "=== Starting Talea Encore Backend ==="

# Encore expects a runtime config file path.
export ENCORE_RUNTIME_CONFIG=/app/infra.config.railway.json
export ENCORE_NO_TELEMETRY=1

# Port configuration
EXTERNAL_PORT="${PORT:-8080}"

echo "Starting Encore on port ${EXTERNAL_PORT}"

# Start Encore
exec /root/.encore/bin/encore run \
  --listen="0.0.0.0:${EXTERNAL_PORT}" \
  --browser=never
