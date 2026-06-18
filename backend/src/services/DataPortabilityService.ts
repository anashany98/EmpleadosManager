import { prisma } from '../lib/prisma';
import { SalaryEncryption } from './SalaryEncryption';
import { createLogger } from './LoggerService';
import { AuthenticatedRequest } from '../types/express';
import { AppError } from '../utils/AppError';

const log = createLogger('DataPortabilityService');

/**
 * GDPR Art.20 — Right to Data Portability
 *
 * Allows a data subject (employee) to request and receive their own
 * personal data in a structured, commonly used, machine-readable
 * format (JSON). This endpoint is self-service: any authenticated
 * employee can export their own data.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export async function getMyDataPortability(user: AuthenticatedRequest['user']) {
    if (!user.employeeId) {
        throw new AppError('No se encontró un registro de empleado asociado a esta cuenta', 404);
    }

    const employeeId = user.employeeId;

    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
            company: true,
            assets: true,
            vacations: true,
            medicalReviews: true,
            trainings: true,
            documents: true,
            payrollRows: {
                include: { batch: true }
            },
            consents: true
        }
    }) as Any;

    if (!employee) {
        throw new AppError('Empleado no encontrado', 404);
    }

    // Fetch time entries for this employee
    const timeEntries = await prisma.timeEntry.findMany({
        where: { employeeId },
        orderBy: { timestamp: 'desc' }
    });

    // Decrypt salary fields (separate from the includes to avoid type issues)
    const salaryDecrypted = {
        annualGrossSalary: SalaryEncryption.decryptSalary(employee.annualGrossSalaryEnc as string | null),
        monthlyGrossSalary: SalaryEncryption.decryptSalary(employee.monthlyGrossSalaryEnc as string | null),
        annualTotalSalary: SalaryEncryption.decryptSalary(employee.annualTotalSalaryEnc as string | null),
        monthlyTotalSalary: SalaryEncryption.decryptSalary(employee.monthlyTotalSalaryEnc as string | null)
    };

    log.info({ employeeId, exportedBy: user.email }, 'GDPR Art.20 data portability export generated');

    return {
        exportedAt: new Date().toISOString(),
        exportedBy: user.email,
        dataSubject: 'employee',
        regulation: 'GDPR Art.20 — Right to Data Portability',
        employee: {
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            name: employee.name,
            email: employee.email,
            phone: employee.phone,
            dni: employee.dni,
            address: employee.address,
            city: employee.city,
            postalCode: employee.postalCode,
            birthDate: employee.birthDate,
            gender: employee.gender,
            contractType: employee.contractType,
            category: employee.category,
            jobTitle: employee.jobTitle,
            entryDate: employee.entryDate,
            exitDate: employee.exitDate,
            active: employee.active,
            ...salaryDecrypted,
            company: employee.company ? {
                id: employee.company.id,
                name: employee.company.name,
                cif: employee.company.cif
            } : null
        },
        relatedData: {
            assets: employee.assets.map((a: Any) => ({
                id: a.id,
                name: a.name,
                serialNumber: a.serialNumber,
                assignedDate: a.assignedDate,
                returnedDate: a.returnedDate
            })),
            vacations: employee.vacations.map((v: Any) => ({
                id: v.id,
                type: v.type,
                startDate: v.startDate,
                endDate: v.endDate,
                days: v.days,
                status: v.status,
                reason: v.reason
            })),
            medicalReviews: employee.medicalReviews.map((m: Any) => ({
                id: m.id,
                date: m.date,
                result: m.result,
                nextReviewDate: m.nextReviewDate
            })),
            trainings: employee.trainings.map((t: Any) => ({
                id: t.id,
                name: t.name,
                date: t.date,
                provider: t.provider,
                certificate: t.certificate
            })),
            documents: employee.documents.map((d: Any) => ({
                id: d.id,
                name: d.name,
                type: d.type,
                uploadedAt: d.uploadedAt
            })),
            payrollRows: employee.payrollRows.map((p: Any) => ({
                id: p.id,
                grossAmount: p.grossAmount,
                netAmount: p.netAmount,
                deductions: p.deductions,
                employerCost: p.employerCost,
                period: p.period,
                batchDate: p.batch?.createdAt
            })),
            timeEntries: timeEntries.map((t: Any) => ({
                id: t.id,
                type: t.type,
                timestamp: t.timestamp,
                location: t.location,
                device: t.device
            })),
            consents: employee.consents.map((c: Any) => ({
                id: c.id,
                purpose: c.purpose,
                granted: c.granted,
                policyVersion: c.policyVersion,
                createdAt: c.createdAt
            }))
        },
        metadata: {
            totalAssets: employee.assets.length,
            totalVacations: employee.vacations.length,
            totalMedicalReviews: employee.medicalReviews.length,
            totalTrainings: employee.trainings.length,
            totalDocuments: employee.documents.length,
            totalPayrollRows: employee.payrollRows.length,
            totalConsents: employee.consents.length,
            totalConsentsGranted: employee.consents.filter((c: Any) => c.granted).length,
            totalConsentsDenied: employee.consents.filter((c: Any) => !c.granted).length
        }
    };
}

export const DataPortabilityService = {
    getMyDataPortability
};
