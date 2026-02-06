# =============================================================================
# Multi-Stage Dockerfile for Multithreading Benchmark
# =============================================================================
# 
# This Dockerfile uses pnpm for optimized dependency management:
# - Stage 1: Dependencies - Uses pnpm fetch for offline caching
# - Stage 2: Build - Compiles TypeScript to JavaScript
# - Stage 3: Production - Minimal runtime image
#
# Environment:
# - NODE_OPTIONS includes --experimental-shared-memory for SharedArrayBuffer
# - --max-old-space-size=4096 prevents OOM with heavy Fibonacci tasks
#
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-slim AS dependencies

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files for dependency resolution
COPY package.json pnpm-lock.yaml ./

# Use pnpm fetch to download all dependencies for offline install
# This layer is cached unless package.json or pnpm-lock.yaml changes
RUN pnpm fetch --prod

# Install production dependencies (offline mode)
RUN pnpm install --offline --prod

# -----------------------------------------------------------------------------
# Stage 2: Build
# -----------------------------------------------------------------------------
FROM node:20-slim AS build

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Fetch all dependencies (including devDependencies)
RUN pnpm fetch

# Install all dependencies (offline mode)
RUN pnpm install --offline

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN pnpm run build

# -----------------------------------------------------------------------------
# Stage 3: Production
# -----------------------------------------------------------------------------
FROM node:20-slim AS production

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy production dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy compiled JavaScript from build stage
COPY --from=build /app/dist ./dist

# Copy package.json for metadata
COPY package.json ./

# =============================================================================
# Environment Configuration
# =============================================================================
# 
# --max-old-space-size=4096: Prevents OOM errors with heavy Fibonacci
#   calculations and large Uint8Array transfers (10MB per request).
# 
# Note: SharedArrayBuffer works in Node.js by default (no flags needed).
# The COOP/COEP headers in Express enable cross-origin isolation.
#
# =============================================================================
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV PORT=3000
ENV NODE_ENV=production

# Expose application port
EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Run the application
CMD ["node", "dist/server.js"]