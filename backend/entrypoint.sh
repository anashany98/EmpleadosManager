#!/bin/sh
# Entrypoint script to ensure proper permissions before starting the app
# Runs as root to fix volume permissions, then exec passes control to the CMD

set -e

# Fix permissions on uploads directory (Docker volumes may override ownership)
echo "Fixing uploads directory permissions..."
mkdir -p /app/backend/uploads/documents
chown -R appuser:appgroup /app/backend/uploads
chmod -R 775 /app/backend/uploads

echo "Starting application..."
# Execute the CMD (switches to appuser via USER directive in Dockerfile)
exec "$@"
