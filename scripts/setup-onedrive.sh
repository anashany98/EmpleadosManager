#!/bin/bash
# setup-onedrive.sh - One-time setup for OneDrive off-site backups
# Crea el remote 'onedrive' en rclone para que el sidecar manager_rclone_onedrive
# pueda sincronizar backups automaticamente.
#
# Requisitos:
#   - Docker corriendo
#   - Acceso a un navegador (para OAuth de Microsoft)
#   - Cuenta de Microsoft 365 / OneDrive con espacio suficiente
#
# Uso: ./scripts/setup-onedrive.sh
# Re-ejecutable: si el remote ya existe, lo sobreescribe.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $1"; }

echo ""
echo "============================================="
echo "  SETUP DE ONEDRIVE PARA BACKUPS OFF-SITE"
echo "============================================="
echo ""

# 0. Pre-checks
log_step "0. Verificando prerequisitos..."
if ! command -v docker &> /dev/null; then
    log_error "Docker no esta instalado o no esta en PATH"
    exit 1
fi
if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon no responde. Arrancalo primero."
    exit 1
fi
log_info "Docker OK"

# 1. Create volume if not exists
log_step "1. Asegurando volumen Docker 'rclone_config'..."
if docker volume inspect rclone_config >/dev/null 2>&1; then
    log_info "Volumen ya existe, se reutiliza"
else
    docker volume create rclone_config >/dev/null
    log_info "Volumen creado"
fi

# 2. Interactive rclone config
log_step "2. Configurando remote 'onedrive' (interactivo)"
echo ""
log_warn "A continuacion se abrira el menu de rclone. Sigue estos pasos:"
echo ""
echo "   n          -> New remote"
echo "   name>      -> onedrive"
echo "   Storage>   -> onedrive  (escribe 'onedrive' literal, sin comillas)"
echo "   client_id> -> (dejar vacio, pulsar ENTER)"
echo "   client_secret> -> (dejar vacio, pulsar ENTER)"
echo "   region>    -> 1   (Microsoft Cloud Global)"
echo "   Edit advanced config> -> n"
echo "   Use web browser to authenticate> -> y"
echo "   -> Se abrira el navegador. Inicia sesion con tu cuenta Microsoft 365."
echo "   -> Acepta los permisos que pide rclone."
echo "   -> Vuelve a la terminal: aparecera 'config_type'. Si tienes OneDrive"
echo "      personal elige '1', si es Microsoft 365 Business puede que necesites"
echo "      elegir el drive especifico de tu organizacion."
echo "   -> Confirma con 'y' (Yes this is OK)"
echo "   -> q          -> Quit config"
echo ""
read -p "Pulsa ENTER para abrir el menu interactivo de rclone..."

# Run interactive config in a tty
docker run --rm -it \
    -v rclone_config:/config/rclone \
    rclone/rclone:1 config

# 3. Verify config
log_step "3. Verificando configuracion..."
if ! docker run --rm -v rclone_config:/config/rclone rclone/rclone:1 \
        config show onedrive >/dev/null 2>&1; then
    log_error "El remote 'onedrive' no se creo correctamente."
    log_error "Vuelve a ejecutar este script y revisa los pasos."
    exit 1
fi
log_info "Remote 'onedrive' detectado en rclone.conf"

# 4. Test connection (list root)
log_step "4. Probando conexion (lsd = list directory)..."
if docker run --rm -v rclone_config:/config/rclone rclone/rclone:1 \
        lsd onedrive: 2>&1 | head -10; then
    log_info "Conexion exitosa con OneDrive"
else
    log_error "No se pudo listar la raiz de OneDrive."
    log_error "Pruebas a hacer:"
    log_error "  - Vuelve a 'docker run -it -v rclone_config:/config/rclone rclone/rclone:1 config' y re-autentica"
    log_error "  - Verifica que la cuenta de Microsoft tiene OneDrive activado"
    exit 1
fi

# 5. Test upload (create the destination folder)
log_step "5. Creando carpeta destino 'rrhh-backups' en OneDrive..."
DEST_PATH="${ONEDRIVE_PATH:-rrhh-backups}"
if docker run --rm -v rclone_config:/config/rclone rclone/rclone:1 \
        mkdir "onedrive:$DEST_PATH" 2>&1; then
    log_info "Carpeta 'onedrive:$DEST_PATH' lista"
else
    log_warn "No se pudo crear la carpeta (puede que ya exista, o que la cuenta no tenga permisos)"
    log_warn "El sidecar lo creara automaticamente en el primer sync si tiene permisos"
fi

# 6. Next steps
echo ""
echo "============================================="
log_info "SETUP COMPLETADO"
echo "============================================="
echo ""
log_step "Proximos pasos:"
echo ""
echo "  1. (Opcional) Edita tu .env para personalizar la ruta:"
echo "       ONEDRIVE_PATH=rrhh-backups    (default)"
echo ""
echo "  2. Levanta el sidecar (esperara a que el contenedor 'backup' este healthy):"
echo "       docker compose up -d rclone-onedrive"
echo ""
echo "  3. Sigue los logs en tiempo real:"
echo "       docker compose logs -f rclone-onedrive"
echo ""
echo "  4. Forzar un sync manual (sin esperar 24h):"
echo "       docker compose exec rclone-onedrive rclone sync /data onedrive:$DEST_PATH"
echo ""
echo "  5. Verificar estado de salud:"
echo "       docker inspect --format='{{json .State.Health}}' manager_rclone_onedrive"
echo ""
log_warn "Si el contenedor se queda 'unhealthy', comprueba:"
log_warn "  - docker logs manager_rclone_onedrive"
log_warn "  - ls -la /var/lib/docker/volumes/rrhh_rclone_logs/_data/"
echo ""
