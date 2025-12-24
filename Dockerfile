# syntax=docker/dockerfile:1

# ============================================
# Production Dockerfile for NestJS + Bun
# ============================================

# Build stage
FROM oven/bun:1.3 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install all dependencies (including devDependencies for build)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Prune devDependencies for production
RUN rm -rf node_modules && \
    bun install --frozen-lockfile --production

# ============================================
# Production stage
# ============================================
FROM oven/bun:1.3-slim AS production

# Set environment
ENV NODE_ENV=production
ENV TZ=UTC

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs && \
    chown -R nestjs:nodejs /app

# Copy built application from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

# Switch to non-root user
USER nestjs

# Expose the application port
EXPOSE 2999

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:2999/api/service/health || exit 1

# Start the application
CMD ["bun", "dist/main.js"]
