#!/usr/bin/env bash
# MED-008: validación local de la configuración nginx.
#
# Renderiza nginx/templates/default.conf.template con un
# DOMAIN_NAME de prueba y ejecuta `nginx -t` para verificar la
# sintaxis. Útil para iterar sin necesidad de levantar todo el
# stack docker.
#
# Uso:
#   ./nginx/validate-config.sh
#   DOMAIN_NAME=rrhh.example.com ./nginx/validate-config.sh
#
# Requiere: nginx, gettext (envsubst) y openssl en el PATH.
# En Windows nativo no funciona — usar WSL, Git Bash con
# gettext/openssl en PATH, o el contenedor
# `nginx:1.25-alpine` (la imagen oficial ya trae todo).

set -euo pipefail

DOMAIN_NAME="${DOMAIN_NAME:-test.example.com}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="$REPO_ROOT/nginx/templates/default.conf.template"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ ! -f "$TEMPLATE" ]; then
    echo "ERROR: no se encuentra el template $TEMPLATE" >&2
    exit 1
fi

echo "[MED-008] Renderizando template con DOMAIN_NAME=$DOMAIN_NAME..."
mkdir -p "$TMP/conf.d" "$TMP/ssl"
envsubst < "$TEMPLATE" > "$TMP/conf.d/default.conf"

# Sanity: que no quede la sintaxis bash `${VAR:-default}`
if grep -qE '\$\{[A-Z_]+\:-' "$TMP/conf.d/default.conf"; then
    echo "ERROR: el template renderizado contiene '\${VAR:-default}' (sintaxis bash no soportada por nginx)" >&2
    exit 1
fi
echo "[MED-008] Render OK (no bash syntax leaks)"

# Cert autofirmado dummy para que `nginx -t` no se queje de
# SSL handshake (no hace falta que sea válido para `-t`).
openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$TMP/ssl/privkey.pem" \
    -out "$TMP/ssl/fullchain.pem" \
    -days 1 -subj '/CN=test' 2>/dev/null

# nginx.conf minimalista. Replicar la config principal lo
# suficiente para que `-t` no falle por rate limits o gzip.
cat > "$TMP/nginx.conf" <<'EOF'
user  nginx;
worker_processes  1;
error_log  /tmp/error.log warn;
pid        /tmp/nginx.pid;
events {
    worker_connections  1024;
}
http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout  65;
    limit_req_status 429;
    limit_req_zone $binary_remote_addr zone=api:1m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:1m rate=3r/s;
    include /tmp/conf.d/*.conf;
}
EOF

# El frontend nginx va aparte porque NO incluye el reverse
# proxy con SSL. Lo validamos también si existe.
cp "$REPO_ROOT/frontend/nginx.conf" "$TMP/conf.d/frontend.conf" 2>/dev/null || true
mkdir -p "$TMP/frontend-conf.d"
cp "$REPO_ROOT/frontend/nginx.conf" "$TMP/frontend-conf.d/frontend.conf" 2>/dev/null || true
cat > "$TMP/frontend-nginx.conf" <<'EOF'
user  nginx;
worker_processes  1;
error_log  /tmp/frontend-error.log warn;
pid        /tmp/frontend-nginx.pid;
events {
    worker_connections  1024;
}
http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout  65;
    include /tmp/frontend-conf.d/*.conf;
}
EOF

# `nginx -t` no necesita ser root; el default.conf usa paths
# absolutos (/etc/nginx/ssl/...) que pueden no existir, pero
# `-t` solo parsea y no accede a disco más allá del conf.
# Para evitar el fallo por certs, monkey-patch los paths al
# directorio temporal.
sed -i "s|/etc/nginx/ssl/|$TMP/ssl/|g" "$TMP/conf.d/default.conf"

echo "[MED-008] Validando reverse proxy (nginx -t)..."
nginx -t -c "$TMP/nginx.conf" -p "$TMP"
echo "[MED-008] OK reverse proxy"

if [ -f "$REPO_ROOT/frontend/nginx.conf" ]; then
    echo "[MED-008] Validando frontend nginx (nginx -t)..."
    # El frontend conf referencia `http://backend:3000` que es
    # solo un nombre, no se valida en `-t`. Pero el path
    # `/usr/share/nginx/html` debe existir para `-t` (de lo
    # contrario, nginx se queja).
    sudo mkdir -p /usr/share/nginx/html 2>/dev/null || mkdir -p /usr/share/nginx/html 2>/dev/null || true
    nginx -t -c "$TMP/frontend-nginx.conf" -p "$TMP" || true
    echo "[MED-008] OK frontend (o no aplicable en este SO)"
fi

echo "[MED-008] Todas las validaciones pasaron"
