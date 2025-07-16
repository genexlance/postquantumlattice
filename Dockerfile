# Multi-stage build for post-quantum cryptography functions
FROM node:18-alpine AS builder

# Install build dependencies for OQS library
RUN apk add --no-cache \
    build-base \
    cmake \
    git \
    python3 \
    py3-pip

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY .nvmrc ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build and optimize functions
RUN npm run build:functions

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    libc6-compat

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S netlify -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=netlify:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=netlify:nodejs /app/netlify ./netlify
COPY --from=builder --chown=netlify:nodejs /app/package*.json ./
COPY --from=builder --chown=netlify:nodejs /app/scripts ./scripts

# Set environment variables for production
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=1024"
ENV OQS_ENABLE_KEM_ML_KEM=ON
ENV OQS_MEMORY_LIMIT=256

# Switch to non-root user
USER netlify

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('./netlify/functions/crypto-utils.js')" || exit 1

# Expose port (for local testing)
EXPOSE 8888

# Default command
CMD ["npm", "run", "dev"]