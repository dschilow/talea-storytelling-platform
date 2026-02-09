#!/bin/sh
set -e

# Start nsqlookupd in the background
/nsqlookupd &

# Wait a moment for nsqlookupd to start
sleep 2

# Start nsqd with lookupd address
# Use 0.0.0.0 to listen on all interfaces (required for Railway)
PORT_HTTP="${PORT:-4151}"

mkdir -p /tmp/nsq-data
echo "Starting nsqd on HTTP port: ${PORT_HTTP}"

exec /nsqd \
  --lookupd-tcp-address=localhost:4160 \
  --broadcast-address=${RAILWAY_PUBLIC_DOMAIN:-localhost} \
  --data-path=/tmp/nsq-data \
  --tcp-address=0.0.0.0:4150 \
  --http-address=0.0.0.0:${PORT_HTTP}
