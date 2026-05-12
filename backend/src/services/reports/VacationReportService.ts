import { prisma } from '../../lib/prisma';
import { PaginationParams, getPrismaPagination } from '../../utils/pagination';
import { CacheService } from '../CacheService';
import { CacheKeys } from '../../utils/cacheKeys';
import { getEmployeeVacationBalanceSummary } from '../VacationBalanceService';
import { VACATION_TYPES_FOR_BALANCE } from '../VacationBalanceService';

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

            return CacheService.wrap(cacheKey, async () => this.computeVacationData(year, filters), VACATION_CACHE_TTL);
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
                            startDate: { lte: endOfYear },
                            endDate: { gte: startOfYear },
                            type: { in: VACATION_TYPES_FOR_BALANCE }
                        },
                        select: { id: true }
                    }
                },
                ...prismaPagination
            })
        ]);

        const data = await Promise.all(employees.map(async (emp) => {
            const balance = await getEmployeeVacationBalanceSummary(emp.id, year);
            const totalQuota = balance?.totalEntitledDays ?? emp.vacationDaysTotal ?? 30;
            const usedDays = balance ? balance.importedUsedDays + balance.approvedUsedDays : 0;
            const remainingDays = balance?.availableDays ?? (emp.vacationDaysTotal ?? 30);
            return {
                id: emp.id,
                name: emp.name,
                department: emp.department,
                annualQuotaDays: balance?.annualQuotaDays ?? emp.vacationDaysTotal ?? 30,
                carriedOverDays: balance?.carriedOverDays ?? 0,
                importedUsedDays: balance?.importedUsedDays ?? 0,
                approvedUsedDays: balance?.approvedUsedDays ?? 0,
                pendingDays: balance?.pendingDays ?? 0,
                totalQuota,
                usedDays,
                remainingDays,
                projectedRemainingDays: balance?.projectedAvailableDays ?? remainingDays,
                requests: emp.vacations.length,
                vacations: emp.vacations
            };
        }));

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

    /**
     * Gets absence report grouped by department.
     * Returns statistics per department including total absences, days, and rates.
     */
    static async getAbsencesByDepartment(start: Date, end: Date, filters: { companyId?: string } = {}) {
        const where: any = {
            startDate: { lte: end },
            endDate: { gte: start }
        };

        if (filters.companyId) where.employee = { companyId: filters.companyId };

        const absences = await prisma.vacation.findMany({
            where,
            include: {
                employee: {
                    select: { id: true, name: true, department: true }
                }
            }
        });

        const deptStats: Record<string, any> = {};

        absences.forEach(absence => {
            const dept = absence.employee.department || 'Sin asignar';
            if (!deptStats[dept]) {
                deptStats[dept] = {
                    department: dept,
                    totalAbsences: 0,
                    totalDays: 0,
                    employees: new Set<string>(),
                    vacationDays: 0,
                    sickDays: 0,
                    otherDays: 0,
                    absences: []
                };
            }

            deptStats[dept].totalAbsences++;
            deptStats[dept].totalDays += absence.days || 0;
            deptStats[dept].employees.add(absence.employee.id);

            if (absence.type === 'VACATION') {
                deptStats[dept].vacationDays += absence.days || 0;
            } else if (absence.type === 'SICK_LEAVE') {
                deptStats[dept].sickDays += absence.days || 0;
            } else {
                deptStats[dept].otherDays += absence.days || 0;
            }

            deptStats[dept].absences.push({
                id: absence.id,
                employeeName: absence.employee.name,
                type: absence.type,
                startDate: absence.startDate,
                endDate: absence.endDate,
                days: absence.days
            });
        });

        return Object.values(deptStats).map((dept: any) => ({
            department: dept.department,
            totalAbsences: dept.totalAbsences,
            totalDays: dept.totalDays,
            employeeCount: dept.employees.size,
            avgDaysPerAbsence: dept.totalAbsences > 0 ? Number((dept.totalDays / dept.totalAbsences).toFixed(2)) : 0,
            vacationDays: dept.vacationDays,
            sickDays: dept.sickDays,
            otherDays: dept.otherDays,
            absences: dept.absences
        }));
    }

    /**
     * Gets vacation usage statistics by department for a given year.
     * Returns department stats including total requested, approved, and rejected days.
     */
    static async getUsageByDepartment(year: number, filters: { companyId?: string } = {}) {
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59);

        const where: any = {
            startDate: { lte: endOfYear },
            endDate: { gte: startOfYear }
        };

        if (filters.companyId) where.employee = { companyId: filters.companyId };

        const vacations = await prisma.vacation.findMany({
            where,
            include: {
                employee: {
                    select: { id: true, name: true, department: true }
                }
            }
        });

        const deptStats: Record<string, any> = {};

        vacations.forEach(vacation => {
            const dept = vacation.employee.department || 'Sin asignar';
            if (!deptStats[dept]) {
                deptStats[dept] = {
                    department: dept,
                    totalRequestedDays: 0,
                    totalApprovedDays: 0,
                    totalRejectedDays: 0,
                    approvedCount: 0,
                    rejectedCount: 0,
                    pendingCount: 0,
                    employees: new Set<string>()
                };
            }

            deptStats[dept].totalRequestedDays += vacation.days || 0;
            deptStats[dept].employees.add(vacation.employee.id);

            if (vacation.status === 'APPROVED') {
                deptStats[dept].totalApprovedDays += vacation.days || 0;
                deptStats[dept].approvedCount++;
            } else if (vacation.status === 'REJECTED') {
                deptStats[dept].totalRejectedDays += vacation.days || 0;
                deptStats[dept].rejectedCount++;
            } else if (vacation.status === 'PENDING') {
                deptStats[dept].pendingCount++;
            }
        });

        return Object.values(deptStats).map((dept: any) => ({
            department: dept.department,
            totalRequestedDays: dept.totalRequestedDays,
            totalApprovedDays: dept.totalApprovedDays,
            totalRejectedDays: dept.totalRejectedDays,
            approvedCount: dept.approvedCount,
            rejectedCount: dept.rejectedCount,
            pendingCount: dept.pendingCount,
            employeeCount: dept.employees.size,
            avgDaysPerEmployee: dept.employees.size > 0 ? Number((dept.totalRequestedDays / dept.employees.size).toFixed(2)) : 0
        }));
    }
}
