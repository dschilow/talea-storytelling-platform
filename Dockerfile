# Wrapper Dockerfile to deploy the prebuilt Encore image from GHCR via Railway's Dockerfile source
# Set to your GitHub username/repo (detected from git remote)
FROM ghcr.io/dschilow/talea-storytelling-platform:latest

# Encore container listens on 8080 by default
EXPOSE 8080

