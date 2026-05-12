#!/bin/bash
# Backup Verification Script
# Checks backup integrity and validates restoration capability

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/../backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

echo "========================================="
echo "  BACKUP VERIFICATION REPORT"
echo "========================================="
echo ""

EXIT_CODE=0

# Check 1: Backup directory exists
log_step "1. Checking backup directory..."
if [ -d "$BACKUP_DIR" ]; then
    log_info "Backup directory exists: $BACKUP_DIR"
else
    log_error "Backup directory not found: $BACKUP_DIR"
    EXIT_CODE=1
fi
echo ""

# Check 2: Database backups exist and have content
log_step "2. Checking database backup files..."
SNAPSHOT_DIR="${BACKUP_DIR}/snapshots"
if [ -d "$SNAPSHOT_DIR" ]; then
    DB_BACKUPS=$(find "$SNAPSHOT_DIR" -name "*.dump" -o -name "*.sql" 2>/dev/null | wc -l)
    if [ "$DB_BACKUPS" -gt 0 ]; then
        log_info "Found $DB_BACKUPS database backup(s)"

        # Check if most recent backup has content
        LATEST_DB=$(ls -t "$SNAPSHOT_DIR"/*.dump 2>/dev/null | head -1 || ls -t "$SNAPSHOT_DIR"/*.sql 2>/dev/null | head -1)
        if [ -n "$LATEST_DB" ]; then
            DB_SIZE=$(stat -c%s "$LATEST_DB" 2>/dev/null || stat -f%z "$LATEST_DB" 2>/dev/null || echo "0")
            if [ "$DB_SIZE" -gt 1024 ]; then
                log_info "Latest database backup: $(basename "$LATEST_DB") (${DB_SIZE} bytes)"
            else
                log_error "Latest database backup seems empty: ${DB_SIZE} bytes"
                EXIT_CODE=1
            fi
        fi
    else
        log_warn "No database backups found in $SNAPSHOT_DIR"
    fi
else
    log_warn "Snapshot directory not found: $SNAPSHOT_DIR"
fi
echo ""

# Check 3: Uploads backup directory
log_step "3. Checking uploads backup..."
UPLOADS_BACKUP_DIR="${BACKUP_DIR}/uploads"
if [ -d "$UPLOADS_BACKUP_DIR" ]; then
    UPLOAD_COUNT=$(find "$UPLOADS_BACKUP_DIR" -type f 2>/dev/null | wc -l)
    UPLOAD_SIZE=$(du -sh "$UPLOADS_BACKUP_DIR" 2>/dev/null | cut -f1 || echo "unknown")
    log_info "Uploads backup: $UPLOAD_COUNT files (~${UPLOAD_SIZE})"
else
    log_warn "Uploads backup directory not found: $UPLOADS_BACKUP_DIR"
fi
echo ""

# Check 4: Test restore capability (dry-run using pg_restore --list)
log_step "4. Testing backup restore capability (dry-run)..."
if command -v pg_restore &> /dev/null; then
    # Find a recent .dump file
    DUMP_FILE=$(ls -t "$SNAPSHOT_DIR"/*.dump 2>/dev/null | head -1)
    if [ -n "$DUMP_FILE" ]; then
        log_info "Testing with: $DUMP_FILE"
        # Dry run - list contents without restoring
        if pg_restore --version &> /dev/null; then
            # Check if backup file is valid by listing its contents
            if pg_restore -l "$DUMP_FILE" &> /dev/null; then
                log_info "Backup file structure is valid"
            else
                log_error "Backup file appears corrupted or invalid format"
                EXIT_CODE=1
            fi
        fi
    else
        log_warn "No .dump files found to test"
    fi
else
    log_warn "pg_restore not available - skipping restore test"
fi
echo ""

# Check 5: Verify backup service is running
log_step "5. Checking backup service status..."
if docker ps --format '{{.Names}}' | grep -q "manager_backup"; then
    log_info "Backup container is running"

    # Check last backup time
    LAST_BACKUP=$(docker logs manager_backup 2>&1 | grep -i "backup" | tail -1 || echo "unknown")
    if [ -n "$LAST_BACKUP" ]; then
        log_info "Last backup log: $LAST_BACKUP"
    fi
else
    log_warn "Backup container not found - backup service may not be running"
fi
echo ""

# Check 6: S3 backup status
log_step "6. Checking S3 backup configuration..."
if [ "${BACKUP_S3_ENABLED:-false}" = "true" ]; then
    log_info "S3 backup is enabled"
    if [ -n "${AWS_ACCESS_KEY_ID}" ] && [ -n "${AWS_SECRET_ACCESS_KEY}" ] && [ -n "${BACKUP_S3_BUCKET}" ]; then
        log_info "S3 credentials configured"
    else
        log_error "S3 backup enabled but credentials incomplete"
        EXIT_CODE=1
    fi
else
    log_info "S3 backup is disabled (local only)"
fi
echo ""

# Summary
echo "========================================="
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}  VERIFICATION PASSED${NC}"
    echo "========================================="
    echo ""
    log_info "All backup checks passed"
else
    echo -e "${RED}  VERIFICATION FAILED${NC}"
    echo "========================================="
    echo ""
    log_error "Some backup checks failed - review above output"
fi

exit $EXIT_CODE