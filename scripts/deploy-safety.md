# Política de seguridad para despliegues en Coolify

> **REGLA DE ORO**: la base de datos de Coolify NO se borra, NO se resetea, NO se recrea con volúmenes. Cualquier comando que pueda provocar pérdida de datos está **BLOQUEADO**.

## Scripts de protección incluidos

### `scripts/safe-migrate.sh`

Wrapper para aplicar migraciones de Prisma con guardas automáticas:

- **Detecta prod** por env vars (`NODE_ENV=production`, `DEPLOY_ENV=production`) y por hostname (palabras: `coolify`, `production`, `prod`, `prd`, `live`).
- **Backup OBLIGATORIO en prod** antes de migrar (con `pg_dump` + gzip + timestamp).
- **Valida que el backup no está vacío** — si falla, NO aplica la migración.
- **Falla-loud** en cualquier error.

```bash
# Uso en local (desarrollo)
DATABASE_URL=postgresql://nominas:nominas@localhost:5432/nominas_db \
  ./scripts/safe-migrate.sh

# Uso en prod (vía Coolify exec o SSH al contenedor backend)
DATABASE_URL=$DATABASE_URL \
  NODE_ENV=production \
  DEPLOY_ENV=production \
  ./scripts/safe-migrate.sh
```

### `scripts/safe-docker.sh`

Wrapper de `docker` que **rechaza comandos destructivos**:

Bloquea (con mensaje claro de por qué):

- `docker compose down -v` / `--volumes` / `--remove-orphans`
- `docker volume rm` / `prune`
- `docker system prune --volumes`
- `prisma migrate reset`, `prisma db push --force-reset`, `prisma db drop`
- `DROP DATABASE`, `DROP SCHEMA`, `TRUNCATE`
- `rm -rf` sobre `/data`, `/var/lib/postgresql`, `/app/uploads`, `/app/backups`

```bash
# En lugar de:
docker compose down -v

# Usa:
./scripts/safe-docker.sh compose down      # permitido (NO elimina volúmenes)
```

Si de verdad necesitas saltarte la guarda (NO recomendado):

```bash
SAFE_DOCKER_BYPASS=1 SAFE_DOCKER_REASON="limpieza controlada antes de backup verificado" \
  ./scripts/safe-docker.sh compose down -v
```

## Migraciones actuales

Las migraciones añadidas en este PR son **puramente aditivas** (no pierden datos):

| Migración                                      | Operación                                           | Riesgo                          |
| ---------------------------------------------- | --------------------------------------------------- | ------------------------------- |
| `20260626000000_add_calendar_event_recurrence` | `ALTER TABLE ADD COLUMN` (×2)                       | Ninguno si la columna no existe |
| `20260722000001_add_medical_review_declined`   | `ALTER TABLE ADD COLUMN` (×2) + `CREATE INDEX` (×3) | Ninguno si la columna no existe |

Si la BD de prod ya tiene estas columnas (porque las añadiste a mano antes, como hice en dev), `migrate deploy` fallará con `P3009 drift detected` y el contenedor no arrancará. **Esto NO borra datos**, solo impide el arranque. Solución:

```sql
-- Verificar drift ANTES del primer arranque
SELECT column_name FROM information_schema.columns
WHERE table_name = 'CalendarEvent' AND column_name LIKE 'recurrence%';
SELECT column_name FROM information_schema.columns
WHERE table_name = 'MedicalReview' AND column_name LIKE 'declined%';

-- Si hay drift, marcar la migración como aplicada (la columna ya existe, no la recreamos)
INSERT INTO "_prisma_migrations" (id, migration_name, checksum, finished_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  '20260626000000_add_calendar_event_recurrence',
  'a' || repeat('0', 63),
  NOW(), 1
) ON CONFLICT (migration_name) DO NOTHING;

INSERT INTO "_prisma_migrations" (id, migration_name, checksum, finished_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  '20260722000001_add_medical_review_declined',
  'a' || repeat('0', 63),
  NOW(), 1
) ON CONFLICT (migration_name) DO NOTHING;
```

## Flujo seguro de despliegue

```bash
# 1. ANTES del primer arranque: backup manual de la BD actual
docker exec <postgres-prod> pg_dump -U nominas -d nominas_db \
  --no-owner --no-privileges | gzip > backup-pre-deploy-$(date +%Y%m%d).sql.gz

# 2. Verificar drift (querys de arriba)

# 3. En el entrypoint del contenedor backend, forzar RUN_PRISMA_MIGRATIONS=true
#    (ya está en docker-compose.coolify.yml:68)

# 4. Levantar normalmente. Si falla por drift, seguir paso 2.

# 5. POST-DEPLOY: verificar que el backup sigue ahí y que el contenedor arrancó
docker ps | grep manager_backend  # debe estar Up
docker logs manager_backend | tail -50  # debe decir "Prisma migrations applied"
```

## Lo que JAMÁS debes correr contra la BD de Coolify

```bash
# ❌ NUNCA (borra TODOS los datos)
docker compose down -v
docker volume rm postgres_data
prisma migrate reset
prisma db push --force-reset
prisma db drop

# ❌ NUNCA vía psql
DROP DATABASE nominas_db;
TRUNCATE TABLE "Employee";

# ❌ NUNCA desde el panel de Coolify
#   "Reset database" o similar
```

## Si necesitas revertir un deploy

```bash
# Restaurar el backup más reciente
gunzip -c backups/pre-migrate/backup-YYYYMMDD-HHMMSS.sql.gz | \
  docker exec -i <postgres-prod> psql -U nominas -d nominas_db
```

Y luego `docker compose up -d` para reiniciar el backend con la BD restaurada.
