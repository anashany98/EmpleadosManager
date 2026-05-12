import { prisma } from '../../lib/prisma';
import { PaginationParams, getPrismaPagination } from '../../utils/pagination';

export class OvertimeReportService {
    /**
     * Gets overtime data and calculated costs.
     */
    static async getOvertimeData(start: Date, end: Date, filters: any = {}, pagination?: PaginationParams) {
        const where: any = {
            date: {
                gte: start,
                lte: end
            }
        };

        if (filters.companyId) where.employee = { companyId: filters.companyId };
        if (filters.department) where.employee = { ...where.employee, department: filters.department };

        const prismaPagination = pagination ? getPrismaPagination(pagination) : {};

        const [total, entries] = await Promise.all([
            prisma.overtimeEntry.count({ where }),
            prisma.overtimeEntry.findMany({
                where,
                include: {
                    employee: true
                },
                orderBy: { date: 'asc' },
                ...prismaPagination
            })
        ]);

        return { data: entries, total };
    }
}
