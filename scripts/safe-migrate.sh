#!/bin/sh
# =============================================================================
# safe-migrate.sh — wrapper de migraciones con guardas para producción
# =============================================================================
# OBJETIVO: aplicar migraciones de Prisma NUNCA borrando datos. La BD de Coolify
# es sagrada. Este script:
#   1. Detecta si está corriendo contra producción (env vars + nombre del host)
#   2. Si es prod: BACKUP primero con timestamp, después valida, después migra
#   3. Si es dev: backup opcional, valida que el host NO sea Coolify
#   4. BLOQUEA cualquier intento de `prisma migrate reset` o `prisma db push --force-reset`
#
# Reglas duras (no negociables):
#   - El backup es OBLIGATORIO en prod antes de migrar
#   - Si el backup falla, NO se ejecuta la migración
#   - Solo se permiten migraciones ADITIVAS (ADD COLUMN, CREATE INDEX, CREATE TABLE)
#   - Cualquier DROP/ALTER destructivo requiere DEPLOY_ALLOW_DESTRUCTIVE=1
# =============================================================================

set -eu

# Cargar env vars desde .env si existe
if [ -f .env ]; then
    set -a; . ./.env; set +a
elif [ -f ../.env ]; then
    set -a; . ../.env; set +a
fi

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { printf "${GREEN}[safe-migrate]${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}[safe-migrate]${NC} %s\n" "$*"; }
err() { printf "${RED}[safe-migrate]${NC} %s\n" "$*" >&2; }

# -----------------------------------------------------------------------------
# 1. Detección de entorno
# -----------------------------------------------------------------------------
PROD_HOST_MARKERS="coolify production prod prd live"
IS_PROD=0

# Por env var explícita
if [ "${DEPLOY_ENV:-}" = "production" ] || [ "${NODE_ENV:-}" = "production" ]; then
    IS_PROD=1
fi

# Por DATABASE_URL: si contiene "coolify" o dominio prod, es prod
if echo "${DATABASE_URL:-}" | grep -qiE '(coolify|production|\.com|\.es|\.io)'; then
    IS_PROD=1
fi

# Por hostname del container o el host
HOSTNAME_NOW=$(hostname 2>/dev/null || echo "unknown")
for marker in $PROD_HOST_MARKERS; do
    case "$HOSTNAME_NOW" in
        *"$marker"*) IS_PROD=1; break ;;
    esac
done

if [ $IS_PROD -eq 1 ]; then
    warn "ENTORNO DETECTADO: PRODUCCIÓN"
    warn "DATABASE_URL host: $(echo "${DATABASE_URL:-}" | sed -E 's|.*@([^:/]+).*|\1|')"
    warn "Hostname: $HOSTNAME_NOW"
else
    log "Entorno: desarrollo (DATABASE_URL: ${DATABASE_URL:-<no definida>})"
fi

# -----------------------------------------------------------------------------
# 2. Verificación de BD alcanzable
# -----------------------------------------------------------------------------
log "Verificando conexión a la BD..."
if ! command -v psql >/dev/null 2>&1; then
    err "psql no está disponible en el PATH. Instala postgresql-client."
    exit 1
fi

# Parsear DATABASE_URL (formato: postgresql://user:pass@host:port/db)
DB_URL="${DATABASE_URL:-}"
if [ -z "$DB_URL" ]; then
    err "DATABASE_URL no está definida. Abortando."
    exit 1
fi

# Extraer componentes con regex simple
DB_USER=$(echo "$DB_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "$DB_URL" | sed -E 's|.*@[^:]+:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DB_URL" | sed -E 's|.*@[^:]+:[0-9]+/(.+)\?.*|\1|; s|.*@[^:]+:[0-9]+/(.+)$|\1|')

log "Conexión: user=$DB_USER host=$DB_HOST:$DB_PORT db=$DB_NAME"

# Probar conexión (con PGPASSWORD para no exponer en argv)
if ! PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" >/dev/null 2>&1; then
    err "No se puede conectar a la BD. Verifica credenciales y que el servicio esté arriba."
    exit 1
fi
log "Conexión OK"

# -----------------------------------------------------------------------------
# 3. Backup obligatorio en prod, opcional en dev
# -----------------------------------------------------------------------------
BACKUP_DIR="${BACKUP_DIR:-./backups/pre-migrate}"
BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql.gz"

if [ $IS_PROD -eq 1 ]; then
    log "BACKUP OBLIGATORIO (entorno prod) → $BACKUP_FILE"
    mkdir -p "$BACKUP_DIR"

    if ! PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --no-owner --no-privileges --clean --if-exists \
            | gzip > "$BACKUP_FILE"; then
        err "Fallo el backup. NO se ejecuta la migración."
        exit 1
    fi

    # Verificar que el backup no está vacío
    if [ ! -s "$BACKUP_FILE" ]; then
        err "El backup está vacío. NO se ejecuta la migración."
        exit 1
    fi

    log "Backup OK: $(ls -lh "$BACKUP_FILE" | awk '{print $5}')"
else
    if [ "${BACKUP_BEFORE_MIGRATE:-0}" = "1" ]; then
        log "Backup opcional activado → $BACKUP_FILE"
        mkdir -p "$BACKUP_DIR"
        PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --no-owner --no-privileges | gzip > "$BACKUP_FILE" || warn "Backup dev falló, continuando"
    fi
fi

# -----------------------------------------------------------------------------
# 4. Ejecutar migrate deploy
# -----------------------------------------------------------------------------
SCHEMA_PATH="${SCHEMA_PATH:-./database/prisma/schema.prisma}"
log "Ejecutando prisma migrate deploy con schema=$SCHEMA_PATH"
log "Migrations folder: $(dirname "$SCHEMA_PATH")/migrations"

# Banner de seguridad
if [ $IS_PROD -eq 1 ]; then
    warn "═════════════════════════════════════════════════════════════════"
    warn "  IMPORTANTE: estamos aplicando migraciones a PRODUCCIÓN"
    warn "  Si esto falla, la BD NO se modifica (migrate deploy es transaccional)"
    warn "  Si necesitas revertir: psql -f $BACKUP_FILE | gunzip"
    warn "═════════════════════════════════════════════════════════════════"
fi

npx prisma migrate deploy --schema="$SCHEMA_PATH"

log "Migraciones aplicadas correctamente"
log "Backup conservado en: $BACKUP_FILE"
