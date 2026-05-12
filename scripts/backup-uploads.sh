#!/bin/bash
# Backup Uploads Directory Script
# Backs up uploaded documents and files to backup volume

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/../backups"
UPLOADS_DIR="${SCRIPT_DIR}/../backend/uploads"
UPLOADS_BACKUP_DIR="${BACKUP_DIR}/uploads"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "========================================="
echo "  BACKING UP UPLOADS DIRECTORY"
echo "========================================="
echo ""

# Create backup directory if it doesn't exist
mkdir -p "$UPLOADS_BACKUP_DIR"

# Check if uploads directory exists
if [ ! -d "$UPLOADS_DIR" ]; then
    log_warn "Uploads directory not found: $UPLOADS_DIR"
    exit 0
fi

# Count files before backup
FILE_COUNT=$(find "$UPLOADS_DIR" -type f 2>/dev/null | wc -l)
DIR_SIZE=$(du -sh "$UPLOADS_DIR" 2>/dev/null | cut -f1 || echo "unknown")

log_info "Source: $UPLOADS_DIR"
log_info "Files: $FILE_COUNT (~${DIR_SIZE})"
log_info "Destination: $UPLOADS_BACKUP_DIR"
echo ""

# Perform backup using rsync or cp
log_info "Starting backup..."

if command -v rsync &> /dev/null; then
    # Use rsync for efficient incremental backup
    rsync -av --progress "$UPLOADS_DIR/" "$UPLOADS_BACKUP_DIR/" 2>&1
    BACKUP_RESULT=$?
else
    # Fallback to cp
    log_warn "rsync not found, using cp (full copy each time)"
    cp -r "$UPLOADS_DIR/"* "$UPLOADS_BACKUP_DIR/" 2>&1 || true
    BACKUP_RESULT=$?
fi

if [ $BACKUP_RESULT -eq 0 ]; then
    log_info "Backup completed successfully"

    # Verify backup
    BACKUP_COUNT=$(find "$UPLOADS_BACKUP_DIR" -type f 2>/dev/null | wc -l)
    BACKUP_SIZE=$(du -sh "$UPLOADS_BACKUP_DIR" 2>/dev/null | cut -f1 || echo "unknown")

    echo ""
    log_info "Backup verification:"
    log_info "  Files backed up: $BACKUP_COUNT"
    log_info "  Total size: ~${BACKUP_SIZE}"

    # Create timestamp marker
    echo "$TIMESTAMP" > "${UPLOADS_BACKUP_DIR}/.backup_timestamp"

    echo ""
    echo "========================================="
    log_info "UPLOADS BACKUP COMPLETE"
    echo "========================================="
else
    log_error "Backup failed with error code: $BACKUP_RESULT"
    exit $BACKUP_RESULT
fi