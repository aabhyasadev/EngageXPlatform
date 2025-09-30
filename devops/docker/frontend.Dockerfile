FROM node:20-alpine AS builder

LABEL maintainer="EngageX Team <ops@engagex.com>"
LABEL description="EngageX React Frontend - Build Stage"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production=false

# Copy source code
COPY frontend/ frontend/
COPY shared/ shared/
COPY tsconfig.json ./
COPY tailwind.config.ts ./

# Build frontend
RUN npm run build

# Production image
FROM node:20-alpine

LABEL maintainer="EngageX Team <ops@engagex.com>"
LABEL description="EngageX React Frontend - Production"

# Set environment variables
ENV NODE_ENV=production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser

# Set working directory
WORKDIR /app

# Copy built files from builder
COPY --from=builder --chown=appuser:appuser /app/frontend/dist ./dist
COPY --from=builder --chown=appuser:appuser /app/frontend/server ./server
COPY --from=builder --chown=appuser:appuser /app/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Expose port
EXPOSE 5000

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Run Node.js server
CMD ["node", "server/index.js"]
