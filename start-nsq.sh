#!/bin/sh

# Start nsqlookupd in the background
/nsqlookupd &

# Wait a moment for nsqlookupd to start
sleep 2

# Start nsqd with lookupd address
# Use 0.0.0.0 to listen on all interfaces (required for Railway)
exec /nsqd \
  --lookupd-tcp-address=localhost:4160 \
  --broadcast-address=${RAILWAY_PUBLIC_DOMAIN:-localhost} \
  --tcp-address=0.0.0.0:4150 \
  --http-address=0.0.0.0:4151
