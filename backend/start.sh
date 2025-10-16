#!/bin/bash
set -euo pipefail

echo "=== Starting Talea Encore Backend with Caddy ==="

# Run database migrations first (using Node.js script)
if [ -f "/app/run-migrations.js" ]; then
  echo "Running database migrations..."
  node /app/run-migrations.js
else
  echo "⚠️  No migrations script found, skipping..."
fi

# Encore expects a runtime config file path.
export ENCORE_RUNTIME_CONFIG=/app/infra.config.railway.json
export ENCORE_NO_TELEMETRY=1

# Port configuration
# Encore runs on 4001 (internal)
# Caddy runs on PORT (external, proxies to Encore on 4001)
EXTERNAL_PORT="${PORT:-8080}"
ENCORE_PORT=4001

echo "Starting Encore on internal port ${ENCORE_PORT}"
echo "Starting Caddy on external port ${EXTERNAL_PORT}"
echo "Using runtime config: ${ENCORE_RUNTIME_CONFIG}"

# Check if config file exists
if [ ! -f "$ENCORE_RUNTIME_CONFIG" ]; then
  echo "❌ ERROR: Runtime config not found at $ENCORE_RUNTIME_CONFIG"
  exit 1
fi

echo "✅ Runtime config found"

# Start Encore in background
/root/.encore/bin/encore run \
  --listen="127.0.0.1:${ENCORE_PORT}" \
  --browser=never &

ENCORE_PID=$!

# Wait a bit for Encore to start
sleep 5

# Start Caddy in foreground (with CORS headers)
export PORT=${EXTERNAL_PORT}
cd /app
exec caddy run --config /app/Caddyfile --adapter caddyfile
