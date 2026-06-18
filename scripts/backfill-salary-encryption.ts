/**
 * One-shot backfill script: encrypts any pre-existing salary rows that
 * were stored in plaintext (legacy `Decimal` columns) and writes the
 * ciphertext into the new `*Enc` columns. Then zeroes the legacy
 * Decimal columns so they become non-authoritative.
 *
 * Usage:
 *   1. Ensure the soft-delete + salary-encrypt migrations have been
 *      applied: `npx prisma migrate deploy`.
 *   2. Run this script once: `npx ts-node scripts/backfill-salary-encryption.ts`.
 *   3. Verify with a SELECT that legacy columns are 0 and *Enc
 *      columns are non-null for rows that had salaries.
 *
 * The script is idempotent: rows whose `*Enc` columns are already
 * populated are skipped.
 */
import { prisma } from '../src/lib/prisma';
import { EncryptionService } from '../src/services/EncryptionService';
import { createLogger } from '../src/services/LoggerService';

const log = createLogger('backfill-salary');

const FIELDS = [
    ['annualGrossSalary', 'annualGrossSalaryEnc'],
    ['monthlyGrossSalary', 'monthlyGrossSalaryEnc'],
    ['annualTotalSalary', 'annualTotalSalaryEnc'],
    ['monthlyTotalSalary', 'monthlyTotalSalaryEnc']
] as const;

async function main() {
    // Validate encryption key early
    EncryptionService.validateKey();

    // Only touch rows that have at least one non-zero plaintext salary
    // AND no encrypted value yet (idempotency).
    const employees = await prisma.employee.findMany({
        where: {
            OR: [
                { annualGrossSalary: { gt: 0 } },
                { monthlyGrossSalary: { gt: 0 } },
                { annualTotalSalary: { gt: 0 } },
                { monthlyTotalSalary: { gt: 0 } }
            ]
        },
        select: {
            id: true,
            annualGrossSalary: true,
            monthlyGrossSalary: true,
            annualTotalSalary: true,
            monthlyTotalSalary: true,
            annualGrossSalaryEnc: true,
            monthlyGrossSalaryEnc: true,
            annualTotalSalaryEnc: true,
            monthlyTotalSalaryEnc: true
        }
    });

    log.info({ count: employees.length }, 'Found employees with plaintext salaries');

    let updated = 0;
    let skipped = 0;

    for (const emp of employees) {
        const data: Record<string, string | number | null> = {};
        for (const [plain, enc] of FIELDS) {
            const plainValue = emp[plain] as unknown as { toNumber(): number } | null;
            const encValue = emp[enc];
            if (encValue) {
                // Already encrypted — skip
                continue;
            }
            if (plainValue && typeof plainValue.toNumber === 'function' && plainValue.toNumber() > 0) {
                const num = plainValue.toNumber();
                const ciphertext = EncryptionService.encrypt(num.toFixed(2));
                if (ciphertext) {
                    data[enc] = ciphertext;
                    data[plain] = 0; // zero out the plaintext
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

    log.info({ updated, skipped, total: employees.length }, 'Backfill complete');

    // Verification: print a sample row
    const sample = await prisma.employee.findFirst({
        where: {
            OR: [
                { annualGrossSalaryEnc: { not: null } },
                { monthlyGrossSalaryEnc: { not: null } }
            ]
        },
        select: {
            id: true,
            annualGrossSalary: true,
            monthlyGrossSalary: true,
            annualGrossSalaryEnc: true,
            monthlyGrossSalaryEnc: true
        }
    });

    if (sample) {
        log.info({ sample }, 'Sample post-backfill row (ciphertext should be non-null, plaintext should be 0)');
    } else {
        log.warn('No rows with encrypted salaries found after backfill — was there any data to encrypt?');
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        log.fatal({ err }, 'Backfill failed');
        process.exit(1);
    });
