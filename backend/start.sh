#!/bin/bash
set -euo pipefail

echo "=== Starting Talea Encore Backend ==="

# Encore expects a runtime config file path.
export ENCORE_RUNTIME_CONFIG=/app/infra.config.railway.json
export ENCORE_NO_TELEMETRY=1

# Port configuration
EXTERNAL_PORT="${PORT:-8080}"

echo "Starting Encore on port ${EXTERNAL_PORT}"
echo "Using runtime config: ${ENCORE_RUNTIME_CONFIG}"

# Check if config file exists
if [ ! -f "$ENCORE_RUNTIME_CONFIG" ]; then
  echo "❌ ERROR: Runtime config not found at $ENCORE_RUNTIME_CONFIG"
  exit 1
fi

echo "✅ Runtime config found"
cat $ENCORE_RUNTIME_CONFIG

# Start Encore (it will use the runtime config and connect to Railway's PostgreSQL)
exec /root/.encore/bin/encore run \
  --listen="0.0.0.0:${EXTERNAL_PORT}" \
  --browser=never
