FROM node:18-bullseye

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

COPY package.json ./

# Remove windows package-lock to avoid conflicts
RUN rm -f package-lock.json

# Install dependencies
RUN npm install

COPY . .

# Increase memory for build
ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
