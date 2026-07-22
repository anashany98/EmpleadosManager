#!/bin/sh
# Entrypoint script to ensure proper permissions before starting the app.
# Runs as root only long enough to prepare mounted volumes, then drops
# privileges so the Node.js process runs as appuser.

set -e

# Fix ALL directories that the app creates at runtime.
echo "Fixing directory permissions..."
mkdir -p /app/backend/uploads/documents \
         /app/backend/uploads/vehicle-documents \
         /app/backend/uploads/template-logos \
         /app/backend/data/inbox \
         /app/backend/data/inbox_temp \
         /app/backend/backups/snapshots \
         /app/backend/backups/full
chown -R appuser:appgroup /app/backend/uploads /app/backend/data /app/backend/backups
chmod -R 775 /app/backend/uploads /app/backend/data /app/backend/backups

if [ "${RUN_PRISMA_MIGRATIONS:-false}" = "true" ]; then
  echo "Running Prisma migrations via safe-migrate wrapper..."
  # REGLA: la BD de Coolify NO se borra. safe-migrate.sh toma backup
  # automático antes de aplicar cualquier migración y aborta si falla.
  gosu appuser bash /app/scripts/safe-migrate.sh
fi

echo "Starting application as appuser..."
exec gosu appuser "$@"
