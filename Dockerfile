FROM oven/bun:1.3.5-alpine AS builder

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
    bun install --frozen-lockfile --production --ignore-scripts

# ============================================
# Production stage
# ============================================
FROM oven/bun:1.3.5-alpine AS production

# Install system dependencies and download RDS certificate
RUN apk add --no-cache poppler-utils curl && \
    curl -o /tmp/rds-global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

# Set environment
ENV NODE_ENV=production
ENV TZ=UTC

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs && \
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
