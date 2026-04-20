# Multi-stage production Dockerfile for EmpleadosManager Frontend
# Builds React app with Vite and serves with Nginx

#########################
# Stage 1: Build
#########################
FROM node:22-bullseye AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies strictly from lockfile
RUN npm ci

# Copy shared monorepo package for frontend path aliases
COPY shared /shared

# Copy all frontend source code
COPY frontend .

# Build arguments for Vite (API URL)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Increase memory limit for large builds
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build the application
RUN npm run build

#########################
# Stage 2: Production Runner (Nginx)
#########################
FROM nginx:alpine AS runner

# Install curl for health checks
RUN apk add --no-cache curl

# Remove default nginx configuration
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY --from=builder /app/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user for serving static files (optional, nginx runs as nginx by default)
# Ensure proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Health check - verify nginx is serving the frontend
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Metadata labels
LABEL org.opencontainers.image.title="EmpleadosManager Frontend" \
      org.opencontainers.image.description="React HR Management Frontend" \
      org.opencontainers.image.vendor="Your Company"

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
