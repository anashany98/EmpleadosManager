# Migraciones Sprint Crítico — Runbook de aplicación

**Migraciones a aplicar** (en orden estricto):

1. `20260615000000_add_employee_soft_delete`
2. `20260615000001_encrypt_salary_fields`

---

## Pre-flight

```bash
# 1. Confirmar pre-flight checks del runbook principal
node --version   # 22
npm run db:status
cd backend && npm test -- --run
```

**Stop and rollback si**:
- `prisma migrate status` muestra una migración fallida previa
- Hay empleados con `deletedAt IS NOT NULL` en staging (no debería haber)
- La DB tiene < 100 MB libres (las migraciones son aditivas pero los índices ocupan espacio)

## Aplicar en staging

```bash
# 1. Backup de la DB antes de cualquier cambio
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
    > backups/pre-soft-delete-$(date +%Y%m%d%H%M%S).sql
gzip backups/pre-soft-delete-*.sql

# 2. Aplicar las dos migraciones
cd /opt/rrhh
docker compose exec backend npx prisma migrate deploy

# Expected output:
#   2 migrations found in prisma/migrations
#   Applying migration 20260615000000_add_employee_soft_delete
#   Applying migration 20260615000001_encrypt_salary_fields
#   All migrations have been successfully applied.

# 3. Verificar que las columnas se crearon
docker compose exec postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'Employee' AND column_name LIKE '%Salary%Enc%';
"
# Debe devolver 4 filas: annualGrossSalaryEnc, monthlyGrossSalaryEnc,
# annualTotalSalaryEnc, monthlyTotalSalaryEnc.

# 4. Verificar que los índices están creados
docker compose exec postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "
  SELECT indexname FROM pg_indexes
  WHERE tablename = 'Employee' AND indexname LIKE '%deletedAt%';
"
# Debe devolver: Employee_deletedAt_idx
```

## Backfill de salarios cifrados

```bash
# Solo si la DB tiene empleados existentes con salarios > 0
# en las columnas Decimal (es decir, antes de esta migración)
docker compose exec backend npx ts-node scripts/backfill-salary-encryption.ts

# Expected log:
#   [backfill-salary] Found employees with plaintext salaries
#   [backfill-salary] Backfill complete { updated: N, skipped: M, total: N+M }
#   [backfill-salary] Sample post-backfill row {...}

# Verificar:
docker compose exec postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "
  SELECT
    COUNT(*) FILTER (WHERE \"monthlyGrossSalary\" > 0) AS still_plaintext,
    COUNT(*) FILTER (WHERE \"monthlyGrossSalaryEnc\" IS NOT NULL) AS encrypted
  FROM \"Employee\";
"
# still_plaintext debe ser 0; encrypted debe ser > 0 (si había datos).
```

## Smoke test post-migración

```bash
# 1. La API sigue respondiendo
curl -fsS https://staging.rrhh.example.com/api/health/liveness
curl -fsS https://staging.rrhh.example.com/api/health/readiness

# 2. Login funciona
curl -fsS -X POST https://staging.rrhh.example.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"identifier":"admin@example.com","password":"<STRONG>"}' \
    -c staging-cookies.txt

# 3. Listar empleados (debe excluir los soft-deleted)
curl -fsS https://staging.rrhh.example.com/api/employees -b staging-cookies.txt | jq '.data | length'

# 4. Crear + soft-delete + intentar ver
EMP_ID=$(curl -fsS -X POST https://staging.rrhh.example.com/api/employees \
    -H "Content-Type: application/json" -b staging-cookies.txt \
    -H "X-CSRF-Token: $(grep csrf_token staging-cookies.txt | awk '{print $7}')" \
    -d '{"dni":"99999999Z","name":"Test SoftDelete","monthlyGrossSalary":2000}' | jq -r '.data.id')

curl -fsS -X DELETE https://staging.rrhh.example.com/api/employees/$EMP_ID \
    -b staging-cookies.txt \
    -H "X-CSRF-Token: $(grep csrf_token staging-cookies.txt | awk '{print $7}')"

# Debe devolver 204 y el empleado ya NO debe aparecer en GET
curl -fsS https://staging.rrhh.example.com/api/employees -b staging-cookies.txt | \
    jq ".data | map(select(.id == \"$EMP_ID\")) | length"
# Debe devolver 0 (no aparece en la lista).

# 5. Verificar que el salario descifrado se devuelve correctamente
curl -fsS https://staging.rrhh.example.com/api/employees/$EMP_ID \
    -b staging-cookies.txt | jq '.data | {monthlyGrossSalary, monthlyGrossSalaryEnc}'
# monthlyGrossSalary debe ser 2000 (descifrado);
# monthlyGrossSalaryEnc debe ser null (no estaba en la lista, pero como admin se ve).

# 6. Cleanup
curl -fsS -X DELETE https://staging.rrhh.example.com/api/employees/$EMP_ID \
    -b staging-cookies.txt -H "X-CSRF-Token: $(grep csrf_token staging-cookies.txt | awk '{print $7}')"
```

## Rollback (si falla)

```bash
# Rollback soft-delete (migration 20260615000000)
docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB" \
    < database/prisma/migrations/20260615000000_add_employee_soft_delete/rollback.sql

# Rollback salary encryption (migration 20260615000001)
# WARNING: any encrypted salary data is permanently lost.
docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB" \
    < database/prisma/migrations/20260615000001_encrypt_salary_fields/rollback.sql

# Restore from the pre-migration backup (preferred)
gunzip -c backups/pre-soft-delete-*.sql.gz | \
    docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

## Aplicar en producción

**Same procedure, with these additions**:
1. Notify users 24h before: "El sistema entrará en mantenimiento breve"
2. Schedule during low-traffic window (e.g. 02:00-03:00)
3. Have a senior engineer on call during the migration
4. After successful smoke tests, mark the maintenance window complete
5. Monitor Sentry + Coolify metrics for 1 hour post-migration

**Do not apply if**:
- The smoke tests fail in staging
- The backup script fails to create `backups/pre-soft-delete-*.sql`
- Less than 30 minutes have passed since the previous production deploy
- The CTO is not available
