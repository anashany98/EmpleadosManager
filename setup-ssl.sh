#!/bin/bash
# SSL Certificate Setup Script
# Usage: ./setup-ssl.sh [domain]

DOMAIN=${1:-localhost}
SSL_DIR="./nginx/ssl"

echo "Setting up SSL certificates for: $DOMAIN"

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Generate self-signed certificate (for development/testing)
echo "Generating self-signed certificate..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/fullchain.pem" \
    -subj "/C=ES/ST=Madrid/L=Madrid/O=EmpleadosManager/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:www.$DOMAIN"

echo ""
echo "SSL certificates generated successfully!"
echo "Certificate: $SSL_DIR/fullchain.pem"
echo "Private Key: $SSL_DIR/privkey.pem"
echo ""
echo "For production, replace with Let's Encrypt certificates:"
echo "  certbot certonly --nginx -d $DOMAIN"
echo ""
echo "Then copy certificates to $SSL_DIR/"
