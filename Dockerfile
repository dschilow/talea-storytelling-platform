# Use Node.js 20 with bun
FROM oven/bun:1 as base

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Build frontend and backend
RUN cd backend && bun run build

# Expose port
EXPOSE $PORT

# Start the application
CMD ["sh", "-c", "cd backend && encore run --port=${PORT:-4000}"]