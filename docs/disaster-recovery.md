# Plan de Recuperación ante Desastres (DR)
## Aplicación de Gestión de Empleados

---

## Objetivos de Recuperación

| Métrica | Objetivo | Descripción |
|--------|---------|-------------|
| RTO | 4 horas | Maximum Tiempo de Recuperación |
| RPO | 1 hora | Punto de Recuperación Máximo (1 backup/hora) |

---

## Arquitectura de Respaldo

### Tipos de Backups

1. **Snapshots (Cada hora)**
   - Base de datos PostgreSQL
   - Retención: 24 snapshots (configurable via BACKUP_RETENTION_DAYS)
   - Ubicación: `/backups/snapshots/` + S3 si BACKUP_S3_ENABLED=true

2. **Full Backup (Diario)**
   - Base de datos + archivos subidos (uploads)
   - Retención: 30 días
   - Ubicación: `/backups/full/` + S3

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