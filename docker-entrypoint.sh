#!/bin/sh
set -e

echo "Generating config.js with BACKEND_URL: ${VITE_BACKEND_URL:-http://localhost:4000}"
echo "Generating config.js with CLERK_PUBLISHABLE_KEY: ${VITE_CLERK_PUBLISHABLE_KEY}"

# Generate config.js with runtime environment variables
cat > /usr/share/nginx/html/config.js << EOF
window.ENV = {
  BACKEND_URL: "${VITE_BACKEND_URL:-http://localhost:4000}",
  CLERK_PUBLISHABLE_KEY: "${VITE_CLERK_PUBLISHABLE_KEY}"
};
EOF

echo "config.js generated successfully"
cat /usr/share/nginx/html/config.js

# Substitute PORT environment variable in nginx config
# Default to 8080 if PORT is not set
export PORT=${PORT:-8080}
echo "Configuring nginx to listen on port ${PORT}"
envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
echo "Final nginx config:"
cat /etc/nginx/conf.d/default.conf

echo "Validating nginx configuration..."
nginx -t

# Execute the CMD (start nginx)
exec "$@"
