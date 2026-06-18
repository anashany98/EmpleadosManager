#!/bin/sh
# Entrypoint script to ensure proper permissions before starting the app
# Runs as root to fix volume permissions, then exec passes control to the CMD

set -e

# Fix ALL directories that the app creates at runtime
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

echo "Starting application..."
# Execute the CMD (runs as root inside container — security from Docker cap_drop)
exec "$@"
