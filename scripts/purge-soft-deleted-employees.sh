#!/usr/bin/env bash
# ===========================================================================
# GDPR Data Purge Wrapper
# ===========================================================================
# Wraps the TypeScript purge script so it can be invoked from:
#   - cron (weekly schedule via GdprPurgeScheduler)
#   - SystemD timers
#   - Manual operator runs
#
# Usage:
#   bash scripts/purge-soft-deleted-employees.sh [--no-dry-run] [--retention-years N]
#
# Required env (provided by the Coolify service config):
#   - DATABASE_URL          Postgres connection string
#   - ENCRYPTION_KEY        32-byte AES key (validated by EncryptionService)
#   - NODE_ENV              "production" (logging level)
#
# Exit codes:
#   0  success (or dry-run with no changes)
#   1  invalid arguments
#   2  runtime error (DB unreachable, encryption key invalid, etc.)
# ===========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"

# Load .env if present (local dev only; in Coolify env vars come from the UI)
if [ -f "${PROJECT_ROOT}/.env" ] && [ "${NODE_ENV:-}" != "production" ]; then
    # shellcheck disable=SC1091
    set -a; source "${PROJECT_ROOT}/.env"; set +a
fi

# Parse args
DRY_RUN_FLAG="--dry-run"
RETENTION_YEARS=4
for arg in "$@"; do
    case "$arg" in
        --no-dry-run) DRY_RUN_FLAG="" ;;
        --dry-run)    DRY_RUN_FLAG="--dry-run" ;;
        --retention-years)
            shift
            RETENTION_YEARS="${1:-}"
            if ! [[ "${RETENTION_YEARS}" =~ ^[0-9]+$ ]] || [ "${RETENTION_YEARS}" -lt 1 ]; then
                echo "ERROR: --retention-years must be a positive integer" >&2
                exit 1
            fi
            ;;
        --help|-h)
            echo "Usage: $0 [--no-dry-run] [--retention-years N]"
            exit 0
            ;;
        *)
            echo "ERROR: Unknown argument: $arg" >&2
            exit 1
            ;;
    esac
done

# Validate required env
if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL is not set" >&2
    exit 2
fi
if [ -z "${ENCRYPTION_KEY:-}" ]; then
    echo "ERROR: ENCRYPTION_KEY is not set" >&2
    exit 2
fi

# Run the TypeScript script
cd "${BACKEND_DIR}"
exec npx tsx src/scripts/purge-soft-deleted-employees.ts \
    ${DRY_RUN_FLAG} \
    --retention-years "${RETENTION_YEARS}"