#!/bin/sh
set -eu

export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD es obligatorio}"
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-5}"

VERIFY_DB="${1:-nominas_restore_verify}"
BACKUP_FILE="${2:-}"
HOST_ARGS=""
if [ -n "${POSTGRES_HOST:-}" ]; then
  HOST_ARGS="-h $POSTGRES_HOST -p ${POSTGRES_PORT:-5432}"
fi
case "$VERIFY_DB" in
  nominas_restore_verify_*) ;;
  *) echo "El nombre de la base temporal no es seguro"; exit 1 ;;
esac
case "$VERIFY_DB" in
  *[!a-z0-9_]*) echo "El nombre temporal contiene caracteres no permitidos"; exit 1 ;;
esac

if psql $HOST_ARGS -U "$POSTGRES_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname = '$VERIFY_DB'" | grep -q 1; then
  echo "La base temporal ya existe; se aborta sin modificarla."
  exit 1
fi

createdb $HOST_ARGS -U "$POSTGRES_USER" "$VERIFY_DB"
cleanup() {
  dropdb $HOST_ARGS -U "$POSTGRES_USER" --if-exists "$VERIFY_DB"
}
trap cleanup EXIT

if [ -n "$BACKUP_FILE" ]; then
  test -s "$BACKUP_FILE"
  gzip -t "$BACKUP_FILE"
  gzip -dc "$BACKUP_FILE" | psql $HOST_ARGS -U "$POSTGRES_USER" -d "$VERIFY_DB" >/dev/null
else
  pg_dump $HOST_ARGS -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --format=custom --no-owner --no-privileges |
    pg_restore $HOST_ARGS -U "$POSTGRES_USER" -d "$VERIFY_DB" --no-owner --no-privileges
fi

SOURCE_EMPLOYEES="$(psql $HOST_ARGS -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc 'SELECT count(*) FROM "Employee"')"
RESTORED_EMPLOYEES="$(psql $HOST_ARGS -U "$POSTGRES_USER" -d "$VERIFY_DB" -tAc 'SELECT count(*) FROM "Employee"')"
PERIOD_TABLE="$(psql $HOST_ARGS -U "$POSTGRES_USER" -d "$VERIFY_DB" -tAc \
  "SELECT to_regclass('public.\"EmploymentPeriod\"') IS NOT NULL")"

if [ "$SOURCE_EMPLOYEES" != "$RESTORED_EMPLOYEES" ] || [ "$PERIOD_TABLE" != "t" ]; then
  echo "RESTORE_VERIFY_FAILED source=$SOURCE_EMPLOYEES restored=$RESTORED_EMPLOYEES periods=$PERIOD_TABLE"
  exit 1
fi

echo "RESTORE_VERIFY_OK employees=$RESTORED_EMPLOYEES employment_periods_table=$PERIOD_TABLE"
