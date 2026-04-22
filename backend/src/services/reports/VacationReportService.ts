import { prisma } from '../../lib/prisma';
import { PaginationParams, getPrismaPagination } from '../../utils/pagination';
import { CacheService } from '../CacheService';
import { CacheKeys } from '../../utils/cacheKeys';

// Cache TTL in seconds - 5 minutes
const VACATION_CACHE_TTL = 300;

export class VacationReportService {
    /**
     * Gets vacation balance and history.
     * Results are cached when no pagination is provided (aggregated view).
     */
    static async getVacationData(year: number, filters: any = {}, pagination?: PaginationParams) {
        // Only cache aggregated (non-paginated) vacation data
        if (!pagination) {
            const companyId = filters.companyId || 'global';
            const cacheKey = CacheKeys.vacations(companyId, year);

            return CacheService.wrap(cacheKey, async () => {
                return this.computeVacationData(year, filters);
            }, VACATION_CACHE_TTL);
        }

        // No cache for paginated queries (caller wants a specific subset)
        return this.computeVacationData(year, filters, pagination);
    }

    /**
     * Computes the actual vacation data.
     */
    private static async computeVacationData(year: number, filters: any = {}, pagination?: PaginationParams) {
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59);

        const where: any = {};
        if (filters.companyId) where.companyId = filters.companyId;
        if (filters.department) where.department = filters.department;

        const prismaPagination = pagination ? getPrismaPagination(pagination) : {};

        const [total, employees] = await Promise.all([
            prisma.employee.count({ where }),
            prisma.employee.findMany({
                where,
                include: {
                    vacations: {
                        where: {
                            startDate: {
                                gte: startOfYear,
                                lte: endOfYear
                            }
                        }
                    }
                },
                ...prismaPagination
            })
        ]);

        const data = employees.map(emp => {
            const usedDays = (emp.vacations as any[])
                .filter((v: any) => v.status !== 'REJECTED')
                .reduce((sum, v) => sum + (v.days || 0), 0);
            return {
                id: emp.id,
                name: emp.name,
                department: emp.department,
                totalQuota: emp.vacationDaysTotal || 30,
                usedDays,
                remainingDays: (emp.vacationDaysTotal || 30) - usedDays,
                vacations: emp.vacations
            };
        });

        return { data, total };
    }

    /**
     * Gets detailed absences with duration and classification.
     */
    static async getDetailedAbsenceData(start: Date, end: Date, filters: any = {}, pagination?: PaginationParams) {
        const where: any = {
            startDate: { lte: end },
            endDate: { gte: start }
        };

        if (filters.companyId) where.employee = { companyId: filters.companyId };
        if (filters.department) where.employee = { ...where.employee, department: filters.department };

        const prismaPagination = pagination ? getPrismaPagination(pagination) : {};

        const [total, absences] = await Promise.all([
            prisma.vacation.count({ where }),
            prisma.vacation.findMany({
                where,
                include: {
                    employee: true
                },
                orderBy: { startDate: 'desc' },
                ...prismaPagination
            })
        ]);

        return { data: absences, total };
    }
}
