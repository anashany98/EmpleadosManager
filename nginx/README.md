# Nginx configuration (MED-008)

Reverse proxy y serving del frontend. Renderizado con
`envsubst` al arrancar el contenedor oficial `nginx:1.25-alpine`.

## Estructura

```
nginx/
├── nginx.conf              # Config principal (rate limits, gzip, mime types)
├── templates/              # Templates procesados con envsubst al arrancar
│   └── default.conf.template   # Reverse proxy con SSL + security headers
├── ssl/                    # Certificados (gitignored, montados en runtime)
├── certbot-webroot/        # ACME challenges para Let's Encrypt
└── validate-config.sh      # Script de validación local (MED-008)
```

## Variables de entorno

El reverse proxy (`templates/default.conf.template`) requiere:

| Variable      | Uso                                  | Ejemplo            |
| ------------- | ------------------------------------ | ------------------ |
| `DOMAIN_NAME` | FQDN para `server_name` y retos ACME | `rrhh.example.com` |

Sin `DOMAIN_NAME`, `envsubst` deja la variable vacía y `nginx -t`
falla con un error claro (no se rompe el TLS en silencio).

## Validación local

Con Linux nativo + `nginx` + `gettext` + `openssl` instalados:

```bash
./nginx/validate-config.sh
```

Desde un contenedor (no requiere instalar nada en el host):

```bash
docker run --rm \
  -v "$PWD":/repo:ro \
  -w /repo \
  nginx:1.25-alpine \
  sh -c '
    DOMAIN_NAME=test.example.com \
    envsubst < nginx/templates/default.conf.template > /tmp/default.conf &&
    sed -i "s|/etc/nginx/ssl/|/tmp/|" /tmp/default.conf &&
    openssl req -x509 -newkey rsa:2048 -nodes \
      -keyout /tmp/privkey.pem -out /tmp/fullchain.pem \
      -days 1 -subj "/CN=test" 2>/dev/null &&
    nginx -t -c /dev/stdin <<EOF
events { worker_connections 1024; }
http {
  include /etc/nginx/mime.types;
  limit_req_zone \$binary_remote_addr zone=api:1m rate=10r/s;
  include /tmp/default.conf;
}
EOF
  '
```

## CI

El job `nginx-config-validate` (`.github/workflows/ci-cd.yml`)
corre en cada push/PR. Renderiza el template y valida
`nginx -t` en un contenedor efímero. Si falla, el build
queda bloqueado.

## Historia

Antes (vulnerable): el conf montado tenía
`${DOMAIN_NAME:-localhost}` — sintaxis de bash que nginx no
entiende, así que `server_name` se quedaba con un literal
roto. El bug se manifestaba solo en producción con DNS
real y era invisible en local con `localhost` (donde el
fallo era cosmético). Más serio aún: el frontend nginx
(que se expone directamente bajo Coolify/Traefik) no
tenía CSP, X-Frame-Options, Referrer-Policy ni
Permissions-Policy, dejando el SPA sin defense-in-depth
contra clickjacking/XSS.
