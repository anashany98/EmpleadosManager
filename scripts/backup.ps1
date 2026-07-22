# backup.ps1 — Backup manual de la BD de Coolify (PostgreSQL).
# Uso: powershell -File scripts/backup.ps1
#
# El backup se guarda en backups/manual/ con timestamp. También lo copia a
# /app/backend/backups/ dentro del container backend para que sobreviva
# a un redeploy de Coolify (el volume backend_backups es persistente).

$ErrorActionPreference = 'Stop'
Set-Location "C:\Users\PC\Desktop\RRHH"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupName = "manual-$timestamp.sql.gz"
$localDir = "backups/manual"
$localFile = "$localDir/$backupName"

# 1. Crear directorio local
New-Item -ItemType Directory -Force -Path $localDir | Out-Null

# 2. Hacer pg_dump dentro del container de postgres
#    (pg_dump versión 15 desde el server, sin mismatch)
Write-Host "[backup] Ejecutando pg_dump en manager_db..." -ForegroundColor Cyan
docker exec manager_db sh -c "pg_dump -U nominas -d nominas_db --no-owner --no-privileges | gzip > /tmp/$backupName"

# 3. Copiar al host (para tenerlo también fuera del container)
docker cp "manager_db:/tmp/$backupName" "$localFile"
docker exec manager_db rm -f "/tmp/$backupName"

$size = (Get-Item $localFile).Length
Write-Host "[backup] Backup local creado: $localFile ($size bytes)" -ForegroundColor Green

# 4. Copiar también al volume backend_backups del container backend
#    (sobrevive a redeploys de Coolify)
Write-Host "[backup] Copiando al volume backend_backups..." -ForegroundColor Cyan
docker cp "$localFile" "manager_backend:/app/backend/backups/$backupName"

Write-Host "[backup] Backup disponible en:" -ForegroundColor Green
Write-Host "  - Local:   $localFile" -ForegroundColor Gray
Write-Host "  - Volume:  manager_backend:/app/backend/backups/$backupName" -ForegroundColor Gray
Write-Host ""
Write-Host "[backup] Para restaurar este backup:" -ForegroundColor Yellow
Write-Host "  gunzip -c '$localFile' | docker exec -i manager_db psql -U nominas -d nominas_db" -ForegroundColor Gray
