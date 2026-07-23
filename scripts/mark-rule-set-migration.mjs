// Marca la migración de HIGH-009 (ruleSetVersion) como aplicada
// sin re-ejecutar las anteriores. Usar después de aplicar el ALTER
// TABLE manualmente.
import { Client } from 'pg';
const client = new Client({
  connectionString: 'postgresql://nominas:nominas_local_pw_2026@127.0.0.1:5432/manager_db'
});
await client.connect();
await client.query(`
  CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone NOT NULL DEFAULT now(),
    applied_steps_count integer NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
  );
`);
await client.query(`
  INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, started_at, applied_steps_count)
  VALUES (gen_random_uuid()::text, '', '20260630000000_add_payroll_row_rule_set_version', NOW(), NOW(), 1)
  ON CONFLICT (migration_name) DO NOTHING;
`);
console.log('marcada como aplicada');
await client.end();
