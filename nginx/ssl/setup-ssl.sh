#!/bin/sh
# ============================================================
# SSL Certificate Setup Script for Let's Encrypt
# Run this script ONCE on the VPS to obtain SSL certificates
# After that, auto-renewal is handled by certbot cron/renew timer
#
# Usage:
#   ./nginx/ssl/setup-ssl.sh your-domain.com your-email@example.com
#
# Prerequisites:
#   - Domain DNS pointing to this VPS
#   - Ports 80 and 443 open in firewall
#   - Docker and docker-compose installed
# ============================================================

set -e

DOMAIN="${1:?Usage: $0 <domain> <email>}"
EMAIL="${2:?Usage: $0 <domain> <email>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SSL_DIR="$SCRIPT_DIR"
CERTBOT_WEBROOT="$PROJECT_ROOT/nginx/certbot-webroot"

echo "=== SSL Certificate Setup ==="
echo "Domain: $DOMAIN"
echo "Email:  $EMAIL"
echo ""

# 1. Create webroot directory for ACME challenges
echo "[1/5] Creating ACME challenge directory..."
mkdir -p "$CERTBOT_WEBROOT"

# 2. Create placeholder certificate so nginx can start
echo "[2/5] Creating placeholder certificate for initial nginx start..."
openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/fullchain.pem" \
    -days 1 \
    -subj "/CN=$DOMAIN" 2>/dev/null

echo "      Placeholder cert created (valid 1 day)."

# 3. Update docker-compose to mount certbot webroot
echo "[3/5] Starting nginx with placeholder cert to serve ACME challenges..."
cd "$PROJECT_ROOT"

# Ensure the nginx-proxy container has the certbot webroot mount
# We use docker compose run to avoid modifying docker-compose.yml permanently
docker compose up -d nginx-proxy 2>/dev/null || {
    echo "      Starting all services..."
    docker compose up -d
}

echo "      Waiting for nginx to be ready..."
sleep 5

# 4. Request real certificate from Let's Encrypt
echo "[4/5] Requesting certificate from Let's Encrypt..."
docker run --rm \
    -v "$SSL_DIR:/etc/letsencrypt/live/$DOMAIN:ro" \
    -v "$CERTBOT_WEBROOT:/var/www/certbot:ro" \
    -v "$PROJECT_ROOT/nginx/ssl/letsencrypt:/etc/letsencrypt:rw" \
    certbot/certbot \
    certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

# 5. Copy real certificates to the expected location
echo "[5/5] Installing real certificates..."
LE_DIR="$PROJECT_ROOT/nginx/ssl/letsencrypt/live/$DOMAIN"
if [ -f "$LE_DIR/fullchain.pem" ] && [ -f "$LE_DIR/privkey.pem" ]; then
    cp "$LE_DIR/fullchain.pem" "$SSL_DIR/fullchain.pem"
    cp "$LE_DIR/privkey.pem" "$SSL_DIR/privkey.pem"
    echo "      Real certificates installed!"
else
    echo "      ERROR: Certificates not found at $LE_DIR"
    echo "      Check certbot logs above for errors."
    exit 1
fi

# 6. Reload nginx to use real certificates
echo "      Reloading nginx..."
docker compose exec nginx-proxy nginx -sreload 2>/dev/null || \
    docker compose restart nginx-proxy

echo ""
echo "=== SSL Setup Complete ==="
echo "Your site is now available at: https://$DOMAIN"
echo ""
echo "IMPORTANT: Set up auto-renewal by running the renewal script:"
echo "  ./nginx/ssl/renew-ssl.sh $DOMAIN"
echo ""
echo "Add this to crontab (auto-renew twice daily):"
echo "  0 0,12 * * * $PROJECT_ROOT/nginx/ssl/renew-ssl.sh $DOMAIN >> /var/log/ssl-renew.log 2>&1"
