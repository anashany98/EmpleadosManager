#!/usr/bin/env bash
# scripts/prisma-baseline-legacy.sh
#
# HIGH-005: Reconcilia una BD existente (con SQL legacy aplicado)
# con el árbol de migraciones Prisma. Marca TODAS las migraciones
# Prisma como aplicadas sin ejecutarlas, asumiendo que la BD ya
# tiene el schema equivalente (verificado por `prisma migrate status`).
#
# Cuándo usar:
#   - Cuando `prisma migrate status` reporta migraciones pendientes
#     en una BD que YA tiene el schema (porque se creó con scripts
#     SQL fuera del árbol Prisma, o porque se rotó
#     `_prisma_migrations`).
#   - Después de clonar una BD de producción a un entorno de staging.
#
# Cuándo NO usar:
#   - En una BD recién creada: ejecuta `prisma migrate deploy`
#     directamente.
#   - Si la BD no tiene el schema completo: primero hay que
#     aplicar las migraciones faltantes o restaurar desde backup.
#
# Uso:
#   cd backend && ../scripts/prisma-baseline-legacy.sh
#
# El script falla (exit 1) si `prisma migrate status` reporta
# drift DESPUÉS del baseline, lo que indicaría que la BD no
# coincide realmente con el schema Prisma.

set -euo pipefail

cd "$(dirname "$0")/../backend"

echo "[baseline] Verificando drift antes de marcar migraciones..."
if ! node ../scripts/prisma-local.mjs migrate status > /tmp/prisma_status_before.txt 2>&1; then
    echo "[baseline] ADVERTENCIA: prisma migrate status reporta drift."
    echo "[baseline] Esto es esperable si la BD se creó con SQL legacy."
    echo "[baseline] Revisa el output y confirma que el schema coincide:"
    cat /tmp/prisma_status_before.txt
    echo
    echo "[baseline] Si estás SEGURO de que la BD coincide con el schema actual,"
    echo "[baseline] pulsa Enter para continuar. Ctrl+C para abortar."
    read -r _
fi

echo "[baseline] Marcando todas las migraciones Prisma como aplicadas..."

# Iteramos sobre los directorios de migración
for migration_dir in ../database/prisma/migrations/*/; do
    if [ -d "$migration_dir" ]; then
        migration_name=$(basename "$migration_dir")
        if [ "$migration_name" = "migration_lock.toml" ]; then
            continue
        fi
        echo "[baseline]   - $migration_name"
        if ! node ../scripts/prisma-local.mjs migrate resolve --applied "$migration_name" > /dev/null 2>&1; then
            echo "[baseline]   ! No se pudo marcar $migration_name (puede que ya esté aplicada)"
        fi
    fi
done

echo "[baseline] Verificando estado final..."
if ! node ../scripts/prisma-local.mjs migrate status 2>&1 | tee /tmp/prisma_status_after.txt; then
    echo "[baseline] ERROR: prisma migrate status sigue reportando drift."
    echo "[baseline] Revisa /tmp/prisma_status_after.txt"
    exit 1
fi

if grep -q "Database schema is up to date" /tmp/prisma_status_after.txt; then
    echo "[baseline] OK: schema up to date."
else
    echo "[baseline] ERROR: el estado final no es 'up to date'."
    exit 1
fi
