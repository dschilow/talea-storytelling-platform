# Wrapper Dockerfile to deploy the prebuilt Encore image from GHCR via Railway's Dockerfile source
# Using SHA256 digest to force Railway to pull the exact image (no caching)
# This image contains the CORS fix (using 'cors' field instead of 'global_cors' in encore.app)
FROM ghcr.io/dschilow/talea-storytelling-platform@sha256:ecb6341b4676e11236792b30c96985435573c2553b1758bba828737d0541c236

# Encore container listens on 8080 by default
EXPOSE 8080

