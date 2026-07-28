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
#   - Los drift conocidos solo se reconcilian si la estructura EXACTA ya existe
#   - Un estado parcial o inesperado aborta antes de ejecutar migrate deploy
# =============================================================================

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

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

# Parsear con WHATWG URL para soportar contraseñas codificadas, parámetros SSL
# y URLs sin puerto explícito. Node forma parte del runtime del backend.
db_url_part() {
    DATABASE_URL="$DB_URL" node -e "
      const u = new URL(process.env.DATABASE_URL);
      const field = process.argv[1];
      const values = {
        user: decodeURIComponent(u.username),
        pass: decodeURIComponent(u.password),
        host: u.hostname,
        port: u.port || '5432',
        name: decodeURIComponent(u.pathname.replace(/^\\//, ''))
      };
      process.stdout.write(values[field] || '');
    " "$1"
}

DB_USER=$(db_url_part user)
DB_PASS=$(db_url_part pass)
DB_HOST=$(db_url_part host)
DB_PORT=$(db_url_part port)
DB_NAME=$(db_url_part name)

log "Conexión: user=$DB_USER host=$DB_HOST:$DB_PORT db=$DB_NAME"

# Probar conexión (con PGPASSWORD para no exponer en argv)
if ! PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" >/dev/null 2>&1; then
    err "No se puede conectar a la BD. Verifica credenciales y que el servicio esté arriba."
    exit 1
fi
log "Conexión OK"

# pg_dump no permite respaldar un servidor de una versión mayor. La copia
# obligatoria debe ser realmente ejecutable antes de tocar metadatos Prisma.
SERVER_VERSION_NUM=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" \
    -U "$DB_USER" -d "$DB_NAME" -Atqc "SHOW server_version_num")
SERVER_MAJOR=$((SERVER_VERSION_NUM / 10000))
PG_DUMP_MAJOR=$(pg_dump --version | sed -E 's/.* ([0-9]+)(\..*)?$/\1/')

if [ "$PG_DUMP_MAJOR" -lt "$SERVER_MAJOR" ]; then
    err "pg_dump v$PG_DUMP_MAJOR no puede respaldar PostgreSQL v$SERVER_MAJOR."
    err "Actualiza postgresql-client antes de migrar. No se ha modificado la BD."
    exit 1
fi
log "Compatibilidad backup OK: pg_dump v$PG_DUMP_MAJOR / servidor v$SERVER_MAJOR"

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
# 4. Resolver binario Prisma
# -----------------------------------------------------------------------------
if [ -n "${SCHEMA_PATH:-}" ]; then
    SCHEMA_PATH="$SCHEMA_PATH"
elif [ -f "$SCRIPT_DIR/../database/prisma/schema.prisma" ]; then
    SCHEMA_PATH="$SCRIPT_DIR/../database/prisma/schema.prisma"
elif [ -f "../database/prisma/schema.prisma" ]; then
    SCHEMA_PATH="../database/prisma/schema.prisma"
else
    err "No se encontró database/prisma/schema.prisma."
    exit 1
fi
PRISMA_BIN=""
for candidate in \
    "./node_modules/.bin/prisma" \
    "../node_modules/.bin/prisma" \
    "/app/backend/node_modules/.bin/prisma" \
    "/app/node_modules/.bin/prisma"; do
    if [ -x "$candidate" ]; then
        PRISMA_BIN="$candidate"
        break
    fi
done

run_prisma() {
    if [ -n "$PRISMA_BIN" ]; then
        "$PRISMA_BIN" "$@"
    else
        npx --no-install prisma "$@"
    fi
}

if [ -n "$PRISMA_BIN" ]; then
    log "Usando prisma local: $PRISMA_BIN"
else
    err "No se encontró prisma local. Se aborta para no descargar otra versión."
    exit 1
fi

# -----------------------------------------------------------------------------
# 5. Reconciliación segura de drift conocido
# -----------------------------------------------------------------------------
db_scalar() {
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" \
        -U "$DB_USER" -d "$DB_NAME" -Atqc "$1"
}

migration_applied_count() {
    db_scalar "SELECT count(*) FROM \"_prisma_migrations\"
      WHERE migration_name = '$1'
        AND finished_at IS NOT NULL
        AND rolled_back_at IS NULL"
}

migration_failed_count() {
    db_scalar "SELECT count(*) FROM \"_prisma_migrations\"
      WHERE migration_name = '$1'
        AND finished_at IS NULL
        AND rolled_back_at IS NULL"
}

reconcile_known_migration() {
    migration_name="$1"
    schema_state="$2"
    applied_count=$(migration_applied_count "$migration_name")
    failed_count=$(migration_failed_count "$migration_name")

    case "$schema_state" in
        ready)
            if [ "$applied_count" -gt 0 ]; then
                log "$migration_name ya está aplicada y verificada"
                return
            fi
            if [ "$failed_count" -gt 0 ]; then
                warn "$migration_name tiene un intento fallido; reconciliando metadatos"
                run_prisma migrate resolve --rolled-back "$migration_name" --schema="$SCHEMA_PATH"
            fi
            warn "$migration_name ya existe físicamente con el esquema esperado"
            run_prisma migrate resolve --applied "$migration_name" --schema="$SCHEMA_PATH"
            ;;
        absent)
            if [ "$applied_count" -gt 0 ]; then
                err "$migration_name figura aplicada, pero sus columnas no existen."
                exit 1
            fi
            if [ "$failed_count" -gt 0 ]; then
                warn "$migration_name falló sin dejar estructura; marcando rollback"
                run_prisma migrate resolve --rolled-back "$migration_name" --schema="$SCHEMA_PATH"
            fi
            log "$migration_name no existe todavía; migrate deploy la aplicará"
            ;;
        *)
            err "$migration_name presenta un estado parcial o incompatible."
            err "No se modifican sus metadatos ni se continúa con el despliegue."
            exit 1
            ;;
    esac
}

RECURRENCE_STATE=$(db_scalar "
SELECT CASE
  WHEN (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'CalendarEvent'
      AND column_name IN ('recurrence', 'recurrenceEnd')
  ) = 0 THEN 'absent'
  WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'CalendarEvent'
      AND column_name = 'recurrence' AND data_type = 'text'
      AND is_nullable = 'NO' AND column_default LIKE '%NONE%'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'CalendarEvent'
      AND column_name = 'recurrenceEnd'
      AND data_type = 'timestamp without time zone' AND is_nullable = 'YES'
  ) THEN 'ready'
  ELSE 'partial'
END")

ADVANCED_DAYS_STATE=$(db_scalar "
SELECT CASE
  WHEN NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'EmployeeVacationBalance'
      AND column_name = 'advancedDays'
  ) THEN 'absent'
  WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'EmployeeVacationBalance'
      AND column_name = 'advancedDays' AND data_type = 'numeric'
      AND numeric_precision = 65 AND numeric_scale = 30
      AND is_nullable = 'NO' AND column_default IS NOT NULL
  ) THEN 'ready'
  ELSE 'partial'
END")

reconcile_known_migration \
    "20260626000000_add_calendar_event_recurrence" "$RECURRENCE_STATE"
reconcile_known_migration \
    "20260723000000_add_employee_vacation_balance_advanced_days" "$ADVANCED_DAYS_STATE"

# -----------------------------------------------------------------------------
# 6. Ejecutar migrate deploy
# -----------------------------------------------------------------------------
log "Ejecutando prisma migrate deploy con schema=$SCHEMA_PATH"
log "Migrations folder: $(dirname "$SCHEMA_PATH")/migrations"

if [ $IS_PROD -eq 1 ]; then
    warn "═════════════════════════════════════════════════════════════════"
    warn "  IMPORTANTE: estamos aplicando migraciones a PRODUCCIÓN"
    warn "  Backup verificado: $BACKUP_FILE"
    warn "═════════════════════════════════════════════════════════════════"
fi

run_prisma migrate deploy --schema="$SCHEMA_PATH"
run_prisma migrate status --schema="$SCHEMA_PATH"

log "Migraciones aplicadas correctamente"
log "Backup conservado en: $BACKUP_FILE"
