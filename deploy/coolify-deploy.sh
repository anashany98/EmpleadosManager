#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

REQUIRED_VARS=(
  POSTGRES_USER
  POSTGRES_PASSWORD
  POSTGRES_DB
  DATABASE_URL
  JWT_SECRET
  ENCRYPTION_KEY
  CORS_ORIGIN
  FRONTEND_URL
  VITE_API_URL
  S3_ENDPOINT
  S3_REGION
  S3_BUCKET
  S3_ACCESS_KEY_ID
  S3_SECRET_ACCESS_KEY
)

MISSING=()
for VAR_NAME in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!VAR_NAME:-}" ]]; then
    MISSING+=("$VAR_NAME")
  fi
done

if [[ ${#MISSING[@]} -ne 0 ]]; then
  echo "Missing required environment variables: ${MISSING[*]}" >&2
  echo "Define them in Coolify (Environment Variables) before deploying." >&2
  exit 1
fi

if ! docker network inspect coolify >/dev/null 2>&1; then
  echo "Creating external network: coolify"
  docker network create coolify >/dev/null
fi

echo "Building and starting containers..."
docker compose -f docker-compose.yml up -d --build

echo "Waiting for Postgres to be ready..."
READY=0
for _ in {1..30}; do
  if docker compose -f docker-compose.yml exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done

if [[ $READY -ne 1 ]]; then
  echo "Postgres did not become ready in time." >&2
  exit 1
fi

echo "Running Prisma migrations..."
docker compose -f docker-compose.yml run --rm backend npx prisma migrate deploy --schema=../database/prisma/schema.prisma

echo "Deployment complete."
