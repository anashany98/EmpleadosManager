# Este script se ejecuta UNA VEZ para instalar las tareas
$NetworkPath = Read-Host "Introduce la ruta de red para los backups (o deja vacío para solo local)"
$ScriptPath = "c:\Users\Usuari\Desktop\NominasApp\auto-backup.ps1"

# Tarea 1: Snapshots cada 2h (08:00 a 20:00)
$Trigger = New-ScheduledTaskTrigger -Once -At 08:00
$Trigger.Repetition = New-ScheduledTaskTriggerRepetition -Interval (New-TimeSpan -Hours 2) -Duration (New-TimeSpan -Hours 14)

# NOTA: Para argumentos con espacios, usar comillas escapadas es clave
if ($NetworkPath) {
    $ArgSnapshot = "-File `"$ScriptPath`" -Type SNAPSHOT -NetworkPath `"$NetworkPath`""
    $ArgFull = "-File `"$ScriptPath`" -Type FULL -NetworkPath `"$NetworkPath`""
} else {
    $ArgSnapshot = "-File `"$ScriptPath`" -Type SNAPSHOT"
    $ArgFull = "-File `"$ScriptPath`" -Type FULL"
}

$ActionSnapshot = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $ArgSnapshot
Register-ScheduledTask -TaskName "Nominas_Snapshot_2h" -Trigger $Trigger -Action $ActionSnapshot -Description "Copia ligera de BD cada 2h" -Force

# Tarea 2: Full Backup a las 23:00
$TriggerFull = New-ScheduledTaskTrigger -Daily -At 23:00
$ActionFull = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $ArgFull
Register-ScheduledTask -TaskName "Nominas_Full_24h" -Trigger $TriggerFull -Action $ActionFull -Description "Copia completa diaria" -Force

Write-Host "Tareas programadas correctamente."
Write-Host "Snapshot: 08:00 - 22:00 (Cada 2h)"
Write-Host "Full: 23:00 (Diario)"
