-- Limpia los dos registros de la migración y deja UNO marcado como aplicada.
-- Esto es porque la columna se añadió manualmente con ALTER TABLE antes de
-- que existiera la migración, así que la marcamos como ya aplicada.

DELETE FROM _prisma_migrations
  WHERE migration_name = '20260723000000_add_employee_vacation_balance_advanced_days';

INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count, logs)
VALUES (
  gen_random_uuid()::text,
  'manual' || substr(md5(random()::text), 1, 30),
  '20260723000000_add_employee_vacation_balance_advanced_days',
  NOW(),
  NOW(),
  1,
  NULL
);
