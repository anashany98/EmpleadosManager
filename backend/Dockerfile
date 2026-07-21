# Multi-stage production Dockerfile for EmpleadosManager Backend
# Optimized for security, size, and performance

#########################
# Stage 1: Dependencies (dev + prod for building)
#########################
FROM node:22.12-bullseye AS deps

WORKDIR /app/backend

# Copy package files
COPY backend/package.json ./package.json
COPY backend/package-lock.json ./package-lock.json

# Install ALL dependencies (needed for building)
RUN npm install && npm cache clean --force

#########################
# Stage 2: Builder
#########################
FROM node:22.12-bullseye AS builder

WORKDIR /app

# Prisma infers /app as the project root for the shared schema.
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json

# Copy dependencies from deps stage
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/backend/package.json ./backend/package.json

# Expose backend dependencies at repo root for Prisma's secondary client generator
RUN ln -s /app/backend/node_modules /app/node_modules

# Copy shared modules and database schema
COPY shared ./shared
COPY database ./database

# Copy application source code
COPY backend/tsconfig.json ./backend/tsconfig.json
COPY backend/src ./backend/src
COPY backend/assets ./backend/assets
COPY backend/instrument.js ./backend/instrument.js

# Generate Prisma Client (as root for write access; the builder stage is
# discarded after this stage, so ownership here does not matter).
ENV PRISMA_GENERATE_SKIP_AUTOINSTALL=1
RUN cd backend && npx prisma generate --schema=../database/prisma/schema.prisma

# Build TypeScript
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN cd backend && npm run build

#########################
# Stage 3: Runner (production only)
#########################
FROM node:22.12-bullseye-slim AS runner

# Match the runtime OS with the Prisma client generated in the build stage.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    postgresql-client \
    curl \
    gosu \
 && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --system --gid 1001 appgroup && \
    useradd --system --uid 1001 --gid appgroup --create-home appuser

WORKDIR /app

# Copy production files from builder
COPY --from=builder --chown=appuser:appgroup /app/backend/node_modules ./backend/node_modules
COPY --from=builder --chown=appuser:appgroup /app/backend/package.json ./backend/package.json
COPY --from=builder --chown=appuser:appgroup /app/backend/dist ./backend/dist
COPY --from=builder --chown=appuser:appgroup /app/backend/src/templates ./backend/src/templates
COPY --from=builder --chown=appuser:appgroup /app/backend/assets ./backend/assets
# Seed scripts removed - should not be in production images
COPY --from=builder --chown=appuser:appgroup /app/backend/instrument.js ./backend/instrument.js
COPY --from=builder --chown=appuser:appgroup /app/shared ./shared
COPY --from=builder --chown=appuser:appgroup /app/database ./database

# Create directories with proper permissions
# Ensure uploads/documents, data/inbox exists and is writable by appuser
RUN mkdir -p ./backend/uploads/documents ./backend/uploads/vehicle-documents ./backend/uploads/template-logos ./backend/data/inbox ./backend/data/inbox_temp ./backend/backups/snapshots ./backend/backups/full && \
    chown -R appuser:appgroup /app && \
    chmod -R 775 /app/backend/uploads /app/backend/data /app/backend/backups

# Use wrapper script to fix permissions at runtime
COPY backend/entrypoint.sh /app/entrypoint.sh
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

WORKDIR /app/backend

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENV RETURN_TOKENS=false
# Cap V8 heap so the process fails fast with a clear error instead of
# being killed by the kernel OOM killer when memory runs out. The
# previous OOM crashes inside the Excel parser manifested as silent
# container restarts, which made the entire app appear to hang.
ENV NODE_OPTIONS="--max-old-space-size=1536"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

LABEL org.opencontainers.image.title="EmpleadosManager Backend" \
      org.opencontainers.image.description="Payroll & HR Management API" \
      org.opencontainers.image.vendor="Your Company"

# Use entrypoint to create directories as root, then drop privileges to appuser
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "--require", "./instrument.js", "dist/backend/src/index.js"]
