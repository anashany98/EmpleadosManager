#!/bin/sh
# =============================================================================
# safe-docker.sh — wrapper de docker compose que BLOQUEA comandos destructivos
# =============================================================================
# Regla de oro: la BD de Coolify NO se borra, NI se resetea, NI se recrea con
# volúmenes. Este script envuelve `docker compose` y rechaza cualquier comando
# que pueda provocar pérdida de datos.
#
# Bloquea (independientemente del entorno):
#   - docker compose down -v / --volumes
#   - docker compose down --remove-orphans (puede eliminar volúmenes huérfanos)
#   - docker compose rm -v
#   - docker volume rm / docker volume prune
#   - docker system prune --volumes
#   - psql DROP DATABASE / DROP TABLE / TRUNCATE
#   - prisma migrate reset / prisma db push --force-reset / prisma db drop
#
# Uso: en lugar de `docker compose <cmd>`, ejecuta `safe-docker.sh <cmd>`
# =============================================================================

set -eu

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

err() { printf "${RED}[BLOCKED]${NC} %s\n" "$*" >&2; }
warn() { printf "${YELLOW}[safe-docker]${NC} %s\n" "$*"; }
ok() { printf "${GREEN}[safe-docker]${NC} %s\n" "$*"; }

# -----------------------------------------------------------------------------
# Lista de patrones prohibidos (palabras que matchen = rechazo)
# -----------------------------------------------------------------------------
forbidden_patterns="
    down.*-v
    down.*--volumes
    down.*--remove-orphans
    rm.*-v
    rm.*--volumes
    volume\s+rm
    volume\s+prune
    system\s+prune.*--volumes
    system\s+prune.*-a
    compose\s+down.*--rmi
    --force-reset
    migrate\s+reset
    db\s+push.*--force-reset
    db\s+drop
    DROP\s+DATABASE
    DROP\s+SCHEMA
    TRUNCATE
    rm\s+-rf\s+/data
    rm\s+-rf\s+/var/lib/postgresql
    rm\s+-rf\s+/app.*uploads
    rm\s+-rf\s+/app.*backups
"

# Si SAFE_DOCKER_BYPASS=1 está seteado y SAFE_DOCKER_REASON=<texto>, se permite
# el comando después de pedir confirmación interactiva.

CMD="$*"

if [ "${SAFE_DOCKER_BYPASS:-0}" = "1" ] && [ -n "${SAFE_DOCKER_REASON:-}" ]; then
    warn "BYPASS activo: $SAFE_DOCKER_REASON"
    warn "Ejecutando sin guardas: $CMD"
    exec docker $CMD
fi

# Comprobar cada patrón prohibido
for pat in $forbidden_patterns; do
    if echo "$CMD" | grep -qE "$pat"; then
        err "Comando BLOQUEADO por safety policy"
        err "  Patrón detectado: $pat"
        err "  Comando: $CMD"
        err ""
        err "  La BD de Coolify es IRREEMPLAZABLE. Si crees que necesitas"
        err "  ejecutar este comando, lee scripts/safe-docker.sh primero"
        err "  y usa SAFE_DOCKER_BYPASS=1 SAFE_DOCKER_REASON='<motivo>'"
        exit 1
    fi
done

ok "Comando permitido: $CMD"
exec docker $CMD
