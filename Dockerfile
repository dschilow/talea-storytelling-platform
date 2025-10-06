# Wrapper Dockerfile to deploy the prebuilt Encore image from GHCR via Railway's Dockerfile source
# Set to your GitHub username/repo (detected from git remote)
# Using specific commit SHA to avoid caching issues with :latest tag
FROM ghcr.io/dschilow/talea-storytelling-platform:cb541e8

# Encore container listens on 8080 by default
EXPOSE 8080

