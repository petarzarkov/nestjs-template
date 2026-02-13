FROM oven/bun:1.3.9-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

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
FROM oven/bun:1.3.9-slim AS production

# Install system dependencies and download RDS certificate
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    rm -rf /var/lib/apt/lists/*

# Set environment
ENV NODE_ENV=production
ENV TZ=UTC

WORKDIR /app

# Create non-root user for security
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nestjs && \
    chown -R nestjs:nodejs /app && \
    chown nestjs:nodejs /tmp/rds-global-bundle.pem

# Copy built application from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs --chmod=755 /app/docker-entrypoint.sh ./docker-entrypoint.sh

# Copy RDS certificate
RUN cp /tmp/rds-global-bundle.pem ./rds-global-bundle.pem && \
    chown nestjs:nodejs ./rds-global-bundle.pem

# Switch to non-root user
USER nestjs

# Set commit information
ARG COMMIT_SHA
ENV SERVICE_COMMIT_SHA=${COMMIT_SHA}
ARG COMMIT_MESSAGE
ENV SERVICE_COMMIT_MESSAGE=${COMMIT_MESSAGE}

# Expose the application port
EXPOSE 3001

# Entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]

# Start the application
CMD ["bun", "run", "start"]
