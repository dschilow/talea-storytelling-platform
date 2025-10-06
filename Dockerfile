FROM node:20-slim

# Install Encore CLI and runtime dependencies
RUN apt-get update && apt-get install -y curl bash git ca-certificates && \
    curl -L https://encore.dev/install.sh | bash && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.encore/bin:$PATH"

WORKDIR /app

# Copy backend directory (includes encore.app with CORS config)
COPY backend/ .

# Install bun and dependencies
RUN npm install -g bun && bun install

# Encore listens on port 8080
EXPOSE 8080

# Run Encore - reads CORS config from encore.app
CMD ["encore", "run", "--listen", "0.0.0.0:8080"]
