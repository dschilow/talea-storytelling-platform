# =============================================================================
# Railway Deployment Dockerfile - CORS FIX VERSION
# =============================================================================
# This Dockerfile deploys the prebuilt Encore image with CORS configuration
# The image contains encore.app with 'cors' field (not 'global_cors')
# SHA256 digest ensures exact image version (no tag caching issues)
# =============================================================================

FROM ghcr.io/dschilow/talea-storytelling-platform@sha256:ecb6341b4676e11236792b30c96985435573c2553b1758bba828737d0541c236

# Railway deployment metadata
LABEL railway.deployment="cors-fix-v2"
LABEL railway.timestamp="2025-10-06T11:45:00Z"

# Encore listens on port 8080
EXPOSE 8080

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

