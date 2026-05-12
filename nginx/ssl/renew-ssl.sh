#!/bin/sh
# ============================================================
# SSL Certificate Renewal Script
# Run via cron twice daily (Let's Encrypt recommends this)
#
# Cron example:
#   0 0,12 * * * /path/to/project/nginx/ssl/renew-ssl.sh domain.com >> /var/log/ssl-renew.log 2>&1
# ============================================================

set -e

DOMAIN="${1:?Usage: $0 <domain>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SSL_DIR="$SCRIPT_DIR"
CERTBOT_WEBROOT="$PROJECT_ROOT/nginx/certbot-webroot"
LE_DIR="$PROJECT_ROOT/nginx/ssl/letsencrypt/live/$DOMAIN"

echo "$(date '+%Y-%m-%d %H:%M:%S') - Checking certificate renewal for $DOMAIN..."

# Attempt renewal
docker run --rm \
    -v "$PROJECT_ROOT/nginx/ssl/letsencrypt:/etc/letsencrypt:rw" \
    -v "$CERTBOT_WEBROOT:/var/www/certbot:ro" \
    certbot/certbot \
    renew \
    --quiet \
    --deploy-hook "cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $SSL_DIR/fullchain.pem && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $SSL_DIR/privkey.pem"

# If certificates were renewed, the deploy-hook already copied them.
# Reload nginx to pick up the new certificates.
if [ -f "$LE_DIR/fullchain.pem" ]; then
    # Check if certificates were updated in the last 60 seconds
    if find "$LE_DIR/fullchain.pem" -mmin -1 | grep -q .; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Certificate was renewed. Reloading nginx..."
        docker compose -f "$PROJECT_ROOT/docker-compose.yml" exec nginx-proxy nginx -s reload 2>/dev/null || \
            docker compose -f "$PROJECT_ROOT/docker-compose.yml" restart nginx-proxy
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Nginx reloaded with new certificate."
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Certificate not due for renewal yet."
    fi
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') - WARNING: No certificate found at $LE_DIR"
fi
