/**
 * One-shot backfill script: encrypts any pre-existing PII rows that were
 * stored in plaintext (legacy `dni`, `socialSecurityNumber`, `iban`
 * columns) and writes the ciphertext into the new `*Enc` columns.
 *
 * NOTE: Unlike the salary backfill, the plaintext PII columns are NOT
 * zeroed out after encryption. They are preserved for two reasons:
 *   1. dni is @unique in Prisma and the DB already enforced uniqueness at
 *      INSERT time, so existing rows are guaranteed unique.
 *   2. Recovery: if EncryptionService key is lost or the ciphertext is
 *      corrupted, the plaintext columns allow manual data recovery from
 *      a backup before the migration. Drop the plaintext columns in a
 *      later migration once operational decryption has been verified.
 *
 * Usage:
 *   1. Ensure the encrypt_pii migration has been applied:
 *      `npx prisma migrate deploy`.
 *   2. Run this script once:
 *      `npx tsx scripts/backfill-pii-encryption.ts`.
 *   3. Verify with a SELECT that *Enc columns are non-null for rows that
 *      had PII.
 *
 * The script is idempotent: rows whose `*Enc` columns are already
 * populated are skipped.
 */
import { prisma } from '../backend/src/lib/prisma';
import { EncryptionService } from '../backend/src/services/EncryptionService';
import { createLogger } from '../backend/src/services/LoggerService';

const log = createLogger('backfill-pii');

interface PiiField {
    plaintext: string;
    encrypted: string;
    /** Normalize before encryption (e.g. uppercase, strip spaces). */
    normalize?: (v: string) => string;
}

const FIELDS: PiiField[] = [
    { plaintext: 'dni', encrypted: 'dniEnc', normalize: (v) => v.trim().toUpperCase() },
    { plaintext: 'socialSecurityNumber', encrypted: 'socialSecurityNumberEnc', normalize: (v) => v.trim().replace(/[\s-]/g, '') },
    { plaintext: 'iban', encrypted: 'ibanEnc', normalize: (v) => v.trim().replace(/\s/g, '').toUpperCase() }
];

async function main() {
    // Fail fast if encryption key is missing/invalid
    EncryptionService.validateKey();

    // Touch rows that have any non-empty plaintext PII AND no encrypted value yet
    const employees = await prisma.employee.findMany({
        where: {
            OR: [
                { dni: { not: null } },
                { socialSecurityNumber: { not: null } },
                { iban: { not: null } }
            ]
        },
        select: {
            id: true,
            dni: true,
            socialSecurityNumber: true,
            iban: true,
            dniEnc: true,
            socialSecurityNumberEnc: true,
            ibanEnc: true
        }
    });

    log.info({ count: employees.length }, 'Found employees with plaintext PII');

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const emp of employees) {
        const data: Record<string, string | null> = {};
        for (const field of FIELDS) {
            const plainValue = emp[field.plaintext as 'dni' | 'socialSecurityNumber' | 'iban'];
            const encValue = emp[field.encrypted as 'dniEnc' | 'socialSecurityNumberEnc' | 'ibanEnc'];
            if (encValue) {
                // Already encrypted — skip
                continue;
            }
            if (plainValue && plainValue.trim().length > 0) {
                const normalized = field.normalize ? field.normalize(plainValue) : plainValue;
                try {
                    const ciphertext = EncryptionService.encrypt(normalized);
                    if (ciphertext) {
                        data[field.encrypted] = ciphertext;
                    }
                } catch (err) {
                    log.error({ employeeId: emp.id, field: field.plaintext, err }, 'Failed to encrypt field');
                    errors++;
                }
            }
        }
        if (Object.keys(data).length > 0) {
            await prisma.employee.update({
                where: { id: emp.id },
                data
            });
            updated++;
        } else {
            skipped++;
        }
    }

    log.info({ updated, skipped, errors, total: employees.length }, 'PII backfill complete');

    // Verification: print sample rows
    const samples = await prisma.employee.findMany({
        where: {
            OR: [
                { dniEnc: { not: null } },
                { socialSecurityNumberEnc: { not: null } },
                { ibanEnc: { not: null } }
            ]
        },
        select: {
            id: true,
            dni: true,
            dniEnc: true,
            socialSecurityNumber: true,
            socialSecurityNumberEnc: true,
            iban: true,
            ibanEnc: true
        },
        take: 3
    });

    if (samples.length > 0) {
        log.info({ count: samples.length, samples }, 'Sample post-backfill rows (plaintext preserved for recovery, *Enc populated)');
    } else {
        log.warn('No rows with encrypted PII found after backfill — was there any data to encrypt?');
    }

    if (errors > 0) {
        log.error({ errors }, 'Some rows failed to encrypt. Review and re-run.');
        process.exit(2);
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        log.fatal({ err }, 'Backfill failed');
        process.exit(1);
    });