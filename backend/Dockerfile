FROM node:22-bullseye

# Install system dependencies for canvas (Debian/Ubuntu names)
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

# Install dependencies
RUN npm install

# Copy database schema from root context
COPY database ./database

# Copy backend source code
COPY backend/ .

# Generate Prisma Client (schema is now at ./database/...)
RUN npx prisma generate --schema=./database/prisma/schema.prisma

# Increase memory for build
ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
