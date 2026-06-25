import { prisma } from '../backend/src/lib/prisma';
import { EncryptionService } from '../backend/src/services/EncryptionService';
import { createLogger } from '../backend/src/services/LoggerService';

const log = createLogger('backfill-salary');

const FIELDS = [
    ['annualGrossSalary', 'annualGrossSalaryEnc'],
    ['monthlyGrossSalary', 'monthlyGrossSalaryEnc'],
    ['annualTotalSalary', 'annualTotalSalaryEnc'],
    ['monthlyTotalSalary', 'monthlyTotalSalaryEnc']
] as const;

function toNumber(value: unknown): number {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value) || 0;
    const maybeDecimal = value as { toNumber?: () => number };
    return typeof maybeDecimal.toNumber === 'function' ? maybeDecimal.toNumber() : Number(value) || 0;
}

async function main() {
    EncryptionService.validateKey();

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

    let updated = 0;
    let skipped = 0;

    for (const emp of employees) {
        const data: Record<string, string | number | null> = {};
        for (const [plain, enc] of FIELDS) {
            if (emp[enc]) continue;
            const amount = toNumber(emp[plain]);
            if (amount > 0) {
                data[enc] = EncryptionService.encrypt(amount.toFixed(2));
                data[plain] = 0;
            }
        }

        if (Object.keys(data).length > 0) {
            await prisma.employee.update({ where: { id: emp.id }, data });
            updated++;
        } else {
            skipped++;
        }
    }

    log.info({ updated, skipped, total: employees.length }, 'Backfill complete');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        log.fatal({ err }, 'Backfill failed');
        process.exit(1);
    });
