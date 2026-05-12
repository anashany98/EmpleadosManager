# Multi-stage production Dockerfile for EmpleadosManager Backend
# Optimized for security, size, and performance

#########################
# Stage 1: Dependencies (dev + prod for building)
#########################
FROM node:22-bullseye AS deps

WORKDIR /app/backend

# Copy package files
COPY backend/package.json ./package.json
COPY backend/package-lock.json ./package-lock.json

# Install ALL dependencies (needed for building)
RUN npm install && npm cache clean --force

#########################
# Stage 2: Builder
#########################
FROM node:22-bullseye AS builder

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
COPY backend/instrument.js ./backend/instrument.js

# Create non-root user
RUN useradd --create-home --shell /bin/bash appuser && \
    chown -R appuser:appuser /app

USER appuser

# Generate Prisma Client
ENV PRISMA_GENERATE_SKIP_AUTOINSTALL=1
RUN cd backend && npx prisma generate --schema=../database/prisma/schema.prisma

# Build TypeScript
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN cd backend && npm run build

#########################
# Stage 3: Runner (production only)
#########################
FROM node:22-bullseye AS runner

# Match the runtime OS with the Prisma client generated in the build stage.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg62-turbo-dev \
    libgif-dev \
    postgresql-client \
    curl \
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
# Seed scripts removed - should not be in production images
COPY --from=builder --chown=appuser:appgroup /app/backend/instrument.js ./backend/instrument.js
COPY --from=builder --chown=appuser:appgroup /app/shared ./shared
COPY --from=builder --chown=appuser:appgroup /app/database ./database

# Create directories with proper permissions
# Ensure uploads/documents exists and is writable by appuser
RUN mkdir -p ./backend/uploads/documents ./backend/data && \
    chown -R appuser:appgroup /app/backend && \
    chmod -R 775 /app/backend/uploads

# Use wrapper script to fix permissions at runtime
COPY backend/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

WORKDIR /app/backend

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENV RETURN_TOKENS=false

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

LABEL org.opencontainers.image.title="EmpleadosManager Backend" \
      org.opencontainers.image.description="Payroll & HR Management API" \
      org.opencontainers.image.vendor="Your Company"

# Run directly without entrypoint wrapper (permissions fixed by COPY --chown)
CMD ["node", "--require", "./instrument.js", "dist/backend/src/index.js"]
