# Stage 1: Build
FROM node:22-bullseye AS builder

WORKDIR /app

# Copy package files
# Copy package files
COPY package.json package-lock.json ./

# Install dependencies strictly from lockfile
RUN npm ci

# Copy source code
COPY . .

# Build args for Vite
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Increase memory limit significantly and print debug info
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Run build
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
