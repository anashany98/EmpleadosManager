#!/bin/bash
# ============================================================
# Generate Production Secrets
# Run this script on the VPS to generate cryptographically secure
# values for all environment variables.
#
# Usage:
#   chmod +x scripts/generate-secrets.sh
#   ./scripts/generate-secrets.sh
#
# Then copy the output into your Coolify environment variables
# or .env file on the VPS.
# ============================================================

set -e

echo "============================================"
echo "  Production Secret Generator"
echo "  Generated at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================"
echo ""
echo "IMPORTANT: Copy these values to your Coolify"
echo "environment variables or .env file."
echo "Do NOT save these to git or share them."
echo ""
echo "============================================"

# Generate PostgreSQL password (32 chars, alphanumeric + special)
PG_PASSWORD=$(openssl rand -base64 24 | tr -d '=/+' | head -c 32)
echo "POSTGRES_PASSWORD=${PG_PASSWORD}"
echo ""

# Generate DATABASE_URL
PG_USER="${1:-nominas}"
PG_DB="${2:-nominas_db}"
echo "DATABASE_URL=postgresql://${PG_USER}:${PG_PASSWORD}@postgres:5432/${PG_DB}?schema=public&connection_timeout=10"
echo ""

# Generate JWT_SECRET (64 bytes = 128 hex chars)
JWT_SECRET=$(openssl rand -hex 64)
echo "JWT_SECRET=${JWT_SECRET}"
echo ""

# Generate ENCRYPTION_KEY (exactly 32 chars for AES-256)
ENCRYPTION_KEY=$(openssl rand -hex 16)
echo "ENCRYPTION_KEY=${ENCRYPTION_KEY}"
echo ""

# Generate KIOSK_DEVICE_SECRET
KIOSK_SECRET=$(openssl rand -hex 32)
echo "KIOSK_DEVICE_SECRET=${KIOSK_SECRET}"
echo ""

# Generate backup encryption passphrase
BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "BACKUP_ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY}"
echo ""

# Generate Redis password
REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '=/+' | head -c 24)
echo "REDIS_PASSWORD=${REDIS_PASSWORD}"
echo ""

# Generate CSRF secret (for additional CSRF token signing)
CSRF_SECRET=$(openssl rand -hex 32)
echo "CSRF_SECRET=${CSRF_SECRET}"
echo ""

echo "============================================"
echo "  Security Checklist"
echo "============================================"
echo ""
echo "[ ] COOKIE_SECURE=true"
echo "[ ] COOKIE_SAMESITE=strict (or lax)"
echo "[ ] CORS_ORIGIN=https://your-domain.com"
echo "[ ] FRONTEND_URL=https://your-domain.com"
echo "[ ] NODE_ENV=production"
echo "[ ] LOG_LEVEL=warn"
echo "[ ] SSL certificates installed"
echo ""
echo "Done! Now set these in Coolify or your .env file."
