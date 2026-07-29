import { prisma } from '../../lib/prisma';
import { EncryptionService } from '../EncryptionService';

export interface TerminationReportFilters {
    companyId?: string;
    department?: string;
}

export class TerminationReportService {
    static async getMonthlyTerminations(
        year: number,
        month: number | undefined,
        filters: TerminationReportFilters = {}
    ) {
        const startDate = month
            ? new Date(year, month - 1, 1)
            : new Date(year, 0, 1);
        const endDate = month
            ? new Date(year, month, 0, 23, 59, 59, 999)
            : new Date(year, 11, 31, 23, 59, 59, 999);

        const periods = await prisma.employmentPeriod.findMany({
            where: {
                endDate: { gte: startDate, lte: endDate },
                ...(filters.companyId ? { companyId: filters.companyId } : {}),
                ...(filters.department ? { employee: { department: filters.department } } : {})
            },
            select: {
                id: true,
                endDate: true,
                endReason: true,
                endType: true,
                employee: {
                    select: {
                        id: true,
                        name: true,
                        firstName: true,
                        lastName: true,
                        dni: true,
                        department: true
                    }
                }
            },
            orderBy: [{ endDate: 'desc' }, { employee: { name: 'asc' } }]
        });

        return periods.map((period) => ({
            id: period.id,
            employeeId: period.employee.id,
            employee: `${period.employee.firstName || period.employee.name || ''} ${period.employee.lastName || ''}`.trim(),
            dni: EncryptionService.decrypt(period.employee.dni) || '-',
            department: period.employee.department || 'Sin asignar',
            type: period.endType || 'OTHER',
            reason: period.endReason || 'Sin motivo especificado',
            date: period.endDate
        }));
    }
}
