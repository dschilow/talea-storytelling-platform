# =============================================================================
# Railway Deployment Dockerfile - CORS FIX VERSION
# =============================================================================
# This Dockerfile deploys the prebuilt Encore image from GitHub Container Registry
# The image is built by GitHub Actions with CORS config in railway-infra.config.json
# Using :latest tag - this now includes the CORS fix from commit 29126cb
# =============================================================================

FROM ghcr.io/dschilow/talea-storytelling-platform:latest

# Railway deployment metadata - updated to force Railway to recognize change
LABEL railway.deployment="cors-fix-v3-with-infra-config"
LABEL railway.timestamp="2025-10-06T12:00:00Z"
LABEL railway.commit="29126cb"

# Encore listens on port 8080
EXPOSE 8080

