-- HIGH-009: marcar la migración de ruleSetVersion como aplicada.
-- _prisma_migrations no tiene unique en migration_name; usamos WHERE NOT EXISTS.
INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '', '20260630000000_add_payroll_row_rule_set_version', NOW(), NOW(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260630000000_add_payroll_row_rule_set_version'
);
