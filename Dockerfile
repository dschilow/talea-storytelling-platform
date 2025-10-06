# Use the Encore image built by GitHub Actions
# This image includes CORS config from railway-infra.config.json
FROM ghcr.io/dschilow/talea-storytelling-platform:latest

# Encore listens on port 8080
EXPOSE 8080
