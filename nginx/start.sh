#!/bin/sh
set -eu

if [ -s /etc/nginx/ssl/fullchain.pem ] && [ -s /etc/nginx/ssl/privkey.pem ]; then
  template=/etc/nginx/templates/default.conf.template
  echo "[nginx] Certificado TLS detectado; activando HTTPS."
else
  template=/etc/nginx/templates/http-only.conf
  echo "[nginx] Certificado TLS ausente; activando proxy HTTP sin redirección."
fi

envsubst '$DOMAIN_NAME' < "$template" > /etc/nginx/conf.d/default.conf
nginx -t
exec nginx -g 'daemon off;'
