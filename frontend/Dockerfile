# Stage 1: Build
FROM node:18-bullseye as builder

WORKDIR /app

# Copy package files
COPY package.json ./

# IMPORTANT: Do NOT copy package-lock.json from Windows. 
# We want to generate a fresh one for Linux to ensure correct optional dependencies (esbuild).
RUN rm -f package-lock.json

# Install dependencies (including devDependencies)
RUN npm install

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
