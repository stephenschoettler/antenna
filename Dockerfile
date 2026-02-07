# Antenna Webhook Server
FROM node:20-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Build TypeScript (if using separate build step)
RUN npm run build || true

# Create data directory
RUN mkdir -p /app/data /app/logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start server
CMD ["npm", "start"]
