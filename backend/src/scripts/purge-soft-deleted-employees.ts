#!/usr/bin/env npx tsx
/**
 * GDPR Data Purge Script — Soft-deleted employee data cleanup
 *
 * Finds employees with `deletedAt` older than the configured
 * retention period and purges their personal data while preserving
 * the record structure for referential integrity and legal
 * accounting requirements.
 *
 * Usage:
 *   npx tsx src/scripts/purge-soft-deleted-employees.ts [--dry-run] [--retention-years N]
 *
 * Options:
 *   --dry-run           Preview changes without applying (default: true)
 *   --retention-years   Years to retain soft-deleted data (default: 4)
 *
 * What gets purged:
 *   - PII fields: name, firstName, lastName, email, phone, address,
 *     city, postalCode, province, dni, nss (social security), iban,
 *     birthDate, dniExpiration
 *   - Salary data: all *Enc fields set to null, Decimal fields set to 0
 *   - Private notes, company phone, driving license details
 *
 * What gets preserved (legal requirement):
 *   - Employee record (id, companyId, contractType, department,
 *     category, entryDate, exitDate) for audit trail
 *   - Payroll rows (must be kept 4 years in Spain per LGSS)
 *   - Medical reviews (must be kept 5 years per RD 1299/2006)
 *   - Audit logs (regulatory compliance)
 *
 * Safety:
 *   - Default mode is --dry-run (no changes applied)
 *   - Requires explicit --no-dry-run flag to actually purge
 *   - Logs all purged employee IDs before processing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const dryRun = !args.includes('--no-dry-run');
const retentionIndex = args.indexOf('--retention-years');
const RETENTION_YEARS = retentionIndex !== -1
    ? parseInt(args[retentionIndex + 1], 10)
    : 4;

if (isNaN(RETENTION_YEARS) || RETENTION_YEARS < 1) {
    console.error('Invalid --retention-years value. Must be a positive integer.');
    process.exit(1);
}

const RETENTION_DATE = new Date();
RETENTION_DATE.setFullYear(RETENTION_DATE.getFullYear() - RETENTION_YEARS);

// PII fields to null out during purge
const PII_NULL_FIELDS: Record<string, string | null> = {
    name: null,
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    address: null,
    city: null,
    postalCode: null,
    province: null,
    dni: '(PURGED)',
    socialSecurityNumber: null,
    iban: null,
    birthDate: null,
    dniExpiration: null,
    drivingLicenseType: null,
    companyPhone: null,
    privateNotes: null,
    // Salary encryption fields — must be cleared
    annualGrossSalaryEnc: null,
    monthlyGrossSalaryEnc: null,
    annualTotalSalaryEnc: null,
    monthlyTotalSalaryEnc: null,
};

// Fields to zero out (Decimal columns)
const SALARY_ZERO_FIELDS: Record<string, 0> = {
    annualGrossSalary: 0,
    monthlyGrossSalary: 0,
    annualTotalSalary: 0,
    monthlyTotalSalary: 0,
};

async function main() {
    console.log('='.repeat(60));
    console.log('GDPR Data Purge — Soft-deleted Employee Cleanup');
    console.log('='.repeat(60));
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (changes will be applied!)'}`);
    console.log(`Retention period: ${RETENTION_YEARS} years`);
    console.log(`Purging employees deleted before: ${RETENTION_DATE.toISOString()}`);
    console.log('');

    // Find employees that are soft-deleted and past retention
    const staleEmployees = await prisma.employee.findMany({
        where: {
            deletedAt: { not: null, lt: RETENTION_DATE }
        },
        select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            dni: true,
            email: true,
            deletedAt: true,
            deletionReason: true,
            companyId: true
        },
        orderBy: { deletedAt: 'asc' }
    });

    console.log(`Found ${staleEmployees.length} employees past retention period.\n`);

    if (staleEmployees.length === 0) {
        console.log('Nothing to purge. Exiting.');
        await prisma.$disconnect();
        return;
    }

    // Print employees to be purged
    for (const emp of staleEmployees) {
        const daysSinceDelete = Math.floor(
            (Date.now() - emp.deletedAt!.getTime()) / (1000 * 60 * 60 * 24)
        );
        console.log(`  - ${emp.id}: ${emp.name || emp.firstName || 'Unknown'} (DNI: ${emp.dni})`);
        console.log(`    Deleted: ${emp.deletedAt!.toISOString().slice(0, 10)} (${daysSinceDelete} days ago)`);
        console.log(`    Reason: ${emp.deletionReason || 'N/A'}`);
    }
    console.log('');

    if (dryRun) {
        console.log('DRY RUN — No changes applied.');
        console.log('Run with --no-dry-run to actually purge data.');
        await prisma.$disconnect();
        return;
    }

    // LIVE MODE — actually purge
    let purged = 0;
    let errors = 0;

    for (const emp of staleEmployees) {
        try {
            // 1. Null out PII + salary encryption fields
            await prisma.employee.update({
                where: { id: emp.id },
                data: {
                    ...PII_NULL_FIELDS,
                    ...SALARY_ZERO_FIELDS,
                    // Keep a marker that this was purged
                    name: '(PURGED)',
                    dni: '(PURGED)',
                }
            });

            // 2. Null out salary Decimal columns
            // (SALARY_ZERO_FIELDS handles this above)

            console.log(`  ✓ Purged: ${emp.id} (${emp.dni})`);
            purged++;
        } catch (err: any) {
            console.error(`  ✗ Failed to purge ${emp.id}: ${err.message}`);
            errors++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Purge complete: ${purged} purged, ${errors} errors`);
    console.log('='.repeat(60));

    // Log the purge event to audit
    try {
        await prisma.auditLog.create({
            data: {
                action: 'GDPR_DATA_PURGE_COMPLETED',
                entity: 'Employee',
                entityId: `purge_batch_${Date.now()}`,
                metadata: JSON.stringify({
                    purged,
                    errors,
                    retentionYears: RETENTION_YEARS,
                    dryRun: false
                }),
                userId: null
            }
        });
    } catch {
        // Best effort — don't fail the script if audit logging fails
    }

    await prisma.$disconnect();
}

main().catch(async (err) => {
    console.error('Fatal error:', err);
    await prisma.$disconnect();
    process.exit(1);
});
