# Plan de Recuperación ante Desastres (DR)
## Aplicación de Gestión de Empleados

---

## Objetivos de Recuperación

| Métrica | Objetivo | Descripción |
|--------|---------|-------------|
| RTO | 4 horas | Maximum Tiempo de Recuperación |
| RPO | 24 horas | Punto de Recuperación Máximo (1 backup/día a las 02:00) — Mejorado a <5 minutos si WAL archiving + PITR están habilitados |

> **Nota sobre RPO**: El backup programado por `prodrigestivill/postgres-backup-local` corre diario (`0 2 * * *`). Sin embargo, PostgreSQL está configurado con `wal_level=replica` + `archive_mode=on`, lo que permite **Point-In-Time Recovery (PITR)** hasta el último WAL archivado. Para usar PITR en un escenario real, sigue el procedimiento en "PITR Recovery" más abajo. Para RPO <5 min, habilita WAL shipping continuo a S3.

---

## Arquitectura de Respaldo

### Tipos de Backups

1. **Snapshots (Cada día a las 02:00 UTC)**
   - Base de datos PostgreSQL
   - Retención: configurable via `BACKUP_KEEP_DAYS` (default 30 días)
   - Ubicación: `/backups/snapshots/` + S3 si BACKUP_S3_ENABLED=true

2. **Full Backup (Semanal, domingos 03:00 UTC)**
   - Base de datos + archivos subidos (uploads)
   - Retención: 4 semanas (`BACKUP_KEEP_WEEKS`)
   - Ubicación: `/backups/full/` + S3

3. **WAL Archiving (Continuo)**
   - Permite Point-In-Time Recovery (PITR) hasta el último WAL archivado
   - Configurado en `docker-compose.yml` con `wal_level=replica`, `archive_mode=on`
   - Si se habilita WAL shipping a S3, el RPO efectivo baja a <5 min

3. **Uploads Backup**
   - Scripts dedicados: `scripts/backup-uploads.sh`
   - Incluye: documentos, archivos de empleados, contratos
   - Puede ejecutarse manualmente o via cron

4. **Wal Archiving (Continuo)**
   - Web Archive Loss para recuperación point-in-time
   - Configurado en PostgreSQL

### Configuración de Backups

| Variable | Descripción | Valor Default |
|---------|-------------|---------------|
| BACKUP_SCHEDULE | Cron para backups de DB | `0 2 * * *` (2 AM diario) |
| BACKUP_RETENTION_DAYS | Retención de backups locales | 30 |
| BACKUP_S3_ENABLED | Habilitar upload a S3 | false |
| BACKUP_S3_BUCKET | Bucket S3 para backups | - |
| AWS_ACCESS_KEY_ID | Credencial AWS | - |
| AWS_SECRET_ACCESS_KEY | Secret AWS | - |
| AWS_REGION | Region S3 | us-east-1 |
| S3_ENDPOINT | Endpoint S3 (para MinIO/S3 compatible) | - |

### Estrategias de Recuperación

#### Recuperación Local
```bash
# Verificar backups
./scripts/verify-backups.sh

# Restaurar base de datos
pg_restore -h postgres -U rrhh -d rrhh -v /backups/snapshots/latest.dump
```

#### Recuperación desde S3
```bash
# Descargar backup de S3
aws s3 cp s3://backup-bucket/snapshots/latest.dump /tmp/

# Restaurar
pg_restore -h postgres -U rrhh -d rrhh -v /tmp/latest.dump
```

#### PITR Recovery (Point-In-Time)
Si WAL archiving está habilitado y los WAL se envían a S3, puedes recuperar hasta
cualquier momento entre el último snapshot y el último WAL archivado:

```bash
# 1. Parar postgres
docker compose stop postgres

# 2. Recuperar el último snapshot
docker compose run --rm -v backup_data:/backups postgres \
    pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" /backups/snapshots/latest.dump

# 3. Configurar recovery con target time
docker compose run --rm postgres bash -c '
    cat > /var/lib/postgresql/data/recovery.signal <<EOF
recovery_target_time = "2026-06-18 14:30:00+00"
recovery_target_action = "promote"
EOF
'

# 4. Levantar postgres (aplicará WAL archived hasta el target time)
docker compose up -d postgres
```

---

## Procedimiento de Recuperación

### Escenario 1: Fallo de Base de Datos

1. **Verificar estado del servicio**
   ```bash
   docker ps | grep postgres
   docker logs nominas_db
   ```

2. **Si PostgreSQL no responde**
   ```bash
   # Reiniciar servicio
   docker-compose restart postgres
   
   # Si no responde, verificar logs
   docker logs nominas_db --tail 100
   ```

3. **Si datos corruptos**
   ```bash
   # Restaurar desde último snapshot
   cd backups/snapshots
   pg_restore -h postgres -U nominas -d nominas -v latest_dump_file.dump
   ```

### Escenario 2: Pérdida Total del Servidor

1. **Provisioning nuevo servidor**
   - Instalar Docker y Docker Compose
   - Configurar variables de entorno
   - Clonar repositorio

2. **Restaurar base de datos**
   ```bash
   # Desde último full backup
   docker-compose up -d postgres redis
   docker-compose run --rm backend npx prisma db push
   # Restaurar datos
   pg_restore -h postgres -U nominas -d nominas -v backups/full/latest.zip
   ```

3. **Levantar servicios**
   ```bash
   docker-compose up -d
   ```

### Escenario 3: Ransomware/Ataque

1. **Aislar servidor**
   ```bash
   # Detener servicios inmediatamente
   docker-compose down
   ```

2. **Verificar integridad de backups**
   ```bash
   # Verificar que backups no fueron afectados
   ls -la backups/snapshots/
   ls -la backups/full/
   ```

3. **Restaurar en nuevo environnement**
   - Nuevo servidor limpo
   - Restaurar desde backup limpio
   - Cambiar todas las contraseñas

---

## Contactos de Emergencia

| Rol | Contacto | Teléfono |
|-----|---------|----------|
| DBA | [NOMBRE] | [TELÉFONO] |
| DevOps | [NOMBRE] | [TELÉFONO] |
| Seguridad | [NOMBRE] | [TELÉFONO] |

---

## Verificación Periódica

### Prueba de Restauración (Semanal)
```bash
./scripts/test-restore-backup.sh
```

### Verificación de Backups (Diaria)
- Verificar que backups se crean automáticamente
- Verificar tamaño de archivos (no vacío)
- Verificar que se suben a S3 si está configurado

---

## Checklist de Recuperación

- [ ] PostgreSQL responding
- [ ] Redis responding  
- [ ] Backend health check passing
- [ ] Frontend responding
- [ ] Login funcionando
- [ ] Empleados cargados
- [ ] Documentos accesibles
- [ ] Funciones críticas operando

---

## Backups en Coolify

Para aplicaciones desplegadas en Coolify:

1. **Habilitar backups automáticos**
   - Ir a Settings → Backups
   - Configurar frecuencia: cada hora
   - Retención: 7 días

2. **Backups manuales**
   ```bash
   coolify backup create
   ```

3. **Restaurar desde backup**
   ```bash
   coolify backup list
   coolify restore <backup-id>
   ```

---

## Notas

- Actualizado: $(date)
- Versión: 1.0
- Revisar trimestralmente