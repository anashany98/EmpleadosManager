FROM node:22-bullseye

# Install system dependencies for canvas
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root config files
COPY package*.json ./
COPY docker-compose.yml ./

# Copy database schema
COPY database ./database

# Copy backend package.json and install
COPY backend/package.json ./backend/
RUN cd backend && npm install

# Copy backend source
COPY backend ./backend

# Generate Prisma Client
RUN cd backend && npx prisma generate --schema=../database/prisma/schema.prisma

# Increase memory and build
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN cd backend && npm run build

WORKDIR /app/backend

EXPOSE 3000
ENV NODE_ENV=production

CMD ["npm", "start"]
