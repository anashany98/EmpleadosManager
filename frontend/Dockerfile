# Stage 1: Build
FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./
# Force install dev dependencies (Docker often sets NODE_ENV=production which skips them)
RUN npm install --include=dev

COPY . .

# Build args for Vite
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Increase memory limit for the build process
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Run build
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
