param (
    [string]$Type = "SNAPSHOT", # SNAPSHOT o FULL
    [string]$NetworkPath = $null
)

$ErrorActionPreference = "Stop"
$LogFile = "c:\Users\Usuari\Desktop\NominasApp\backup.log"
$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

function Log-Message {
    param([string]$Msg)
    "$Timestamp - $Msg" | Out-File -FilePath $LogFile -Append
}

try {
    Log-Message "Iniciando backup tipo $Type..."

    # 1. Llamar a la API Local
    $Body = @{ type = $Type } | ConvertTo-Json
    $Response = Invoke-RestMethod -Uri "http://localhost:3000/api/config/backup" -Method Post -Body $Body -ContentType "application/json"

    if ($Response.success) {
        $LocalFile = $Response.data.filePath # La API devuelve la ruta absoluta del archivo generado
        Log-Message "Backup local creado: $LocalFile"

        # 2. Copia a Red (si se configura)
        if ($NetworkPath -and (Test-Path $NetworkPath)) {
            $FileName = Split-Path $LocalFile -Leaf
            $DestFile = Join-Path $NetworkPath $FileName
            
            Copy-Item -Path $LocalFile -Destination $DestFile -Force
            Log-Message "Copiado a red: $DestFile"
            
            # Limpieza en red (mantener últimos 30 archivos que empiecen igual)
            $Prefix = if ($Type -eq "FULL") { "nominas_full_" } else { "nominas_snapshot_" }
            $Files = Get-ChildItem -Path $NetworkPath -Filter "$Prefix*.zip"
            if ($Type -eq "SNAPSHOT") { $Files = Get-ChildItem -Path $NetworkPath -Filter "$Prefix*.db" }

            $Files | Sort-Object CreationTime -Descending | Select-Object -Skip 30 | Remove-Item
        } elseif ($NetworkPath) {
            Log-Message "ERROR: No se encuentra la ruta de red $NetworkPath. Backup local mantenido."
        }
    } else {
        throw "La API devolvió error: $($Response.message)"
    }

} catch {
    Log-Message "ERROR FATAL: $_"
    exit 1
}
