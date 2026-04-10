#!/bin/bash
# Test Restore Backup Script
# Este script prueba que los backups se pueden restaurar correctamente

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/../backups"

echo "========================================="
echo "  TEST DE RESTAURACIÓN DE BACKUP"
echo "========================================="
echo ""

# Configuración
TEST_DB_NAME="nominas_test_restore"
POSTGRES_USER="${POSTGRES_USER:-nominas}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que existe el directorio de backups
if [ ! -d "$BACKUP_DIR" ]; then
    log_error "Directorio de backups no encontrado: $BACKUP_DIR"
    exit 1
fi

# Buscar el snapshot más reciente
SNAPSHOT_DIR="${BACKUP_DIR}/snapshots"
if [ ! -d "$SNAPSHOT_DIR" ]; then
    log_error "Directorio de snapshots no encontrado: $SNAPSHOT_DIR"
    exit 1
fi

LATEST_SNAPSHOT=$(ls -t "$SNAPSHOT_DIR"/*.dump 2>/dev/null | head -1)
if [ -z "$LATEST_SNAPSHOT" ]; then
    log_error "No se encontraron archivos de backup en $SNAPSHOT_DIR"
    exit 1
fi

log_info "Usando snapshot: $LATEST_SNAPSHOT"

# Verificar que el archivo no esté vacío
if [ ! -s "$LATEST_SNAPSHOT" ]; then
    log_error "El archivo de backup está vacío"
    exit 1
fi

# Verificar que pg_restore está disponible
if ! command -v pg_restore &> /dev/null; then
    log_error "pg_restore no está disponible"
    exit 1
fi

# Verificar conexión a PostgreSQL
log_info "Verificando conexión a PostgreSQL..."
if ! pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" > /dev/null 2>&1; then
    log_error "No se puede conectar a PostgreSQL"
    exit 1
fi

log_info "Conexión a PostgreSQL exitosa"

# Crear base de datos de test si no existe
log_info "Creando base de datos de test..."
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -c "
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE datname = '$TEST_DB_NAME' AND pid <> pg_backend_pid();
" 2>/dev/null || true

psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -c "
    DROP DATABASE IF EXISTS $TEST_DB_NAME;
    CREATE DATABASE $TEST_DB_NAME;
" > /dev/null 2>&1

log_info "Base de datos de test creada: $TEST_DB_NAME"

# Intentar restaurar el backup
log_info "Restaurando backup..."

if pg_restore -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$TEST_DB_NAME" -v "$LATEST_SNAPSHOT" 2>&1; then
    log_info "¡Restauración exitosa!"
    
    # Verificar tablas principales
    log_info "Verificando integridad de datos..."
    
    TABLE_COUNT=$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$TEST_DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
    
    if [ "$TABLE_COUNT" -gt 0 ]; then
        log_info "Se restauraron $TABLE_COUNT tablas correctamente"
    else
        log_warn "No se encontraron tablas en la base de datos restaurada"
    fi
    
    # Verificar que la tabla de empleados existe
    if psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$TEST_DB_NAME" -c "SELECT 1 FROM employees LIMIT 1" > /dev/null 2>&1; then
        log_info "Tabla 'employees' verificada correctamente"
    fi
    
    echo ""
    echo "========================================="
    log_info "TEST DE RESTAURACIÓN PASÓ"
    echo "========================================="
    
    # Limpiar
    log_info "Limpiando base de datos de test..."
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -c "DROP DATABASE $TEST_DB_NAME;" > /dev/null 2>&1
    
    exit 0
else
    log_error "Error al restaurar el backup"
    
    echo ""
    echo "========================================="
    log_error "TEST DE RESTAURACIÓN FALLÓ"
    echo "========================================="
    
    # Limpiar
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -c "DROP DATABASE IF EXISTS $TEST_DB_NAME;" > /dev/null 2>&1
    
    exit 1
fi