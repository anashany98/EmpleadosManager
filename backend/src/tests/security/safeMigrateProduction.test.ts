import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../../..');
const SAFE_MIGRATE = path.join(ROOT, 'scripts/safe-migrate.sh');
const DOCKERFILE = path.join(ROOT, 'backend/Dockerfile');

describe('safe-migrate de producción', () => {
    const script = fs.readFileSync(SAFE_MIGRATE, 'utf8');
    const dockerfile = fs.readFileSync(DOCKERFILE, 'utf8');

    it('incluye cliente PostgreSQL 17 para la base de producción', () => {
        expect(dockerfile).toContain('postgresql-client-17');
        expect(dockerfile).not.toContain('postgresql-client-15');
    });

    it('aborta cuando pg_dump es anterior al servidor', () => {
        expect(script).toContain('PG_DUMP_MAJOR');
        expect(script).toContain('SERVER_MAJOR');
        expect(script).toMatch(/PG_DUMP_MAJOR"\s+-lt\s+"\$SERVER_MAJOR/);
    });

    it('resuelve correctamente la URL y la ruta del schema en el contenedor', () => {
        expect(script).toContain('new URL(process.env.DATABASE_URL)');
        expect(script).toContain("u.port || '5432'");
        expect(script).toContain('$SCRIPT_DIR/../database/prisma/schema.prisma');
    });

    it('reconcilia únicamente las dos migraciones con drift verificado', () => {
        expect(script).toContain('20260626000000_add_calendar_event_recurrence');
        expect(script).toContain('20260723000000_add_employee_vacation_balance_advanced_days');
        expect(script).toContain('RECURRENCE_STATE');
        expect(script).toContain('ADVANCED_DAYS_STATE');
        expect(script).toContain('migrate resolve --applied');
    });

    it('aborta ante un esquema parcial y no falsifica checksums', () => {
        expect(script).toContain('estado parcial o incompatible');
        expect(script).not.toContain('INSERT INTO "_prisma_migrations"');
        expect(script).not.toContain("repeat('0'");
    });

    it('mantiene backup obligatorio antes de reconciliar o migrar', () => {
        const backupIndex = script.indexOf('BACKUP OBLIGATORIO');
        const reconcileIndex = script.indexOf('Reconciliación segura de drift conocido');
        const deployIndex = script.indexOf('run_prisma migrate deploy');
        expect(backupIndex).toBeGreaterThan(-1);
        expect(reconcileIndex).toBeGreaterThan(backupIndex);
        expect(deployIndex).toBeGreaterThan(reconcileIndex);
    });
});
