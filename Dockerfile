# Use the Encore image built by GitHub Actions
# This image includes CORS config from railway-infra.config.json
FROM ghcr.io/dschilow/talea-storytelling-platform:latest

# Set runtime config path for Encore
ENV ENCORE_RUNTIME_CONFIG=/app/railway-infra.config.json

# Encore listens on port 8080
EXPOSE 8080
