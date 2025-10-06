FROM node:20-alpine

# Install Encore CLI and runtime dependencies
RUN apk add --no-cache curl bash git ca-certificates && \
    curl -L https://encore.dev/install.sh | bash

ENV PATH="/root/.encore/bin:$PATH"

WORKDIR /app

# Copy entire backend
COPY . .

# Install bun and dependencies
RUN npm install -g bun && bun install

# Encore listens on port 8080
EXPOSE 8080

# Run Encore in production mode with railway config (includes CORS)
CMD ["encore", "run", "--config", "railway-infra.config.json"]
