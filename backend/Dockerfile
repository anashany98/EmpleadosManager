# Stage 1: Build
FROM node:22-bullseye AS builder

# Install system dependencies for canvas (Build time)
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend package.json from root context
COPY backend/package.json ./

# Remove windows package-lock to avoid conflicts
RUN rm -f package-lock.json

# Install dependencies (including devDependencies)
RUN npm install

# Copy database schema from root context
COPY database ./database

# Copy backend source code
COPY backend/ .

# Generate Prisma Client
RUN npx prisma generate --schema=./database/prisma/schema.prisma

# Increase memory for build
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Run build (emits even with errors if configured in tsconfig)
RUN npm run build

# Stage 2: Runtime
FROM node:22-bullseye-slim

# Install ONLY runtime dependencies for canvas
RUN apt-get update && apt-get install -y \
    libcairo2 \
    libjpeg62-turbo \
    libpango-1.0-0 \
    libgif7 \
    librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built files and runtime dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/database ./database

EXPOSE 3000

CMD ["npm", "start"]
