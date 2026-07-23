-- HIGH-005 follow-up: marcar las migraciones pendientes como
-- aplicadas. Las tablas ya existen en la BD (creadas por SQLs
-- legacy / sprints previos), así que solo añadimos las filas de
-- control en _prisma_migrations.
INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '', '20260618000001_encrypt_dni_nss_iban', NOW(), NOW(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260618000001_encrypt_dni_nss_iban');

INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '', '20260625000000_add_vacation_advanced_days', NOW(), NOW(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260625000000_add_vacation_advanced_days');

INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '', '20260625000001_add_absence_type_config', NOW(), NOW(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260625000001_add_absence_type_config');

INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '', '20260629000000_add_inbox_company_id', NOW(), NOW(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260629000000_add_inbox_company_id');

INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '', '20260629000001_add_obras_module', NOW(), NOW(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260629000001_add_obras_module');
