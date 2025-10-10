# Multi-stage build für Talea App

# Stage 1: Frontend Build
FROM oven/bun:1.2.23 AS frontend-builder

WORKDIR /app

# Copy frontend files
COPY frontend/package.json frontend/bun.lock* ./frontend/
COPY frontend/ ./frontend/

# Install frontend dependencies and build
WORKDIR /app/frontend
RUN bun install --frozen-lockfile
RUN bun run build

# Stage 2: Backend Build with Encore
FROM oven/bun:1.2.23 AS backend-builder

WORKDIR /app

# Install Encore CLI
RUN curl -L https://encore.dev/install.sh | bash
ENV PATH="/root/.encore/bin:${PATH}"

# Copy backend files
COPY backend/ ./backend/
COPY encore.app ./

# Copy built frontend into backend static files
COPY --from=frontend-builder /app/frontend/dist ./backend/static/

# Build backend with Encore
WORKDIR /app/backend
RUN bun install --frozen-lockfile

# Stage 3: Runtime
FROM debian:bookworm-slim

# Install ca-certificates for HTTPS
RUN apt-get update && \
    apt-get install -y ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy encore.app file
COPY encore.app ./

# Copy built backend from Encore
COPY --from=backend-builder /app/backend ./backend/
COPY --from=backend-builder /root/.encore /root/.encore

# Copy Bun runtime
COPY --from=backend-builder /usr/local/bin/bun /usr/local/bin/bun

ENV PATH="/root/.encore/bin:${PATH}"
ENV NODE_ENV=production

# Expose port (Railway sets PORT env var)
EXPOSE 8080

# Start Encore server
CMD ["bun", "run", "/root/.encore/bin/encore", "run", "--port=8080"]
