import { prisma } from '../../lib/prisma';
import { PaginationParams, getPrismaPagination } from '../../utils/pagination';
import { CacheService } from '../CacheService';
import { CacheKeys } from '../../utils/cacheKeys';
import { getEmployeeVacationBalanceSummary, VACATION_TYPES_FOR_BALANCE, roundVacationValue, calculateVacationOverlapDays } from '../VacationBalanceService';

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
     * Computes the actual vacation data using batched queries instead of N+1.
     */
    private static async computeVacationData(year: number, filters: any = {}, pagination?: PaginationParams) {
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59);

        const where: any = {};
        if (filters.companyId) where.companyId = filters.companyId;
        if (filters.department) where.department = filters.department;

        const prismaPagination = pagination ? getPrismaPagination(pagination) : {};

        const [total, employees, balances] = await Promise.all([
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
                        select: {
                            startDate: true,
                            endDate: true,
                            status: true,
                            type: true
                        }
                    }
                },
                ...prismaPagination
            }),
            prisma.employeeVacationBalance.findMany({
                where: {
                    year,
                    ...(filters.companyId ? { employee: { companyId: filters.companyId } } : {}),
                    ...(filters.department ? { employee: { department: filters.department } } : {})
                },
                select: {
                    employeeId: true,
                    annualQuotaDays: true,
                    carriedOverDays: true,
                    importedUsedDays: true,
                    advancedDays: true
                }
            })
        ]);

        const balanceMap = new Map(balances.map(b => [b.employeeId, b]));

        const data = employees.map((emp) => {
            const explicitBalance = balanceMap.get(emp.id);
            const quota = explicitBalance
                ? Number(explicitBalance.annualQuotaDays)
                : (emp.vacationDaysTotal ?? 30);
            const carriedOver = explicitBalance ? Number(explicitBalance.carriedOverDays) : 0;
            const importedUsed = explicitBalance ? Number(explicitBalance.importedUsedDays) : 0;
            const advanced = explicitBalance ? Number(explicitBalance.advancedDays ?? 0) : 0;

            const totalEntitled = roundVacationValue(quota + carriedOver);

            const approvedUsedDays = emp.vacations.reduce((sum, v) => {
                if (v.status !== 'APPROVED') return sum;
                return sum + calculateVacationOverlapDays(v, year);
            }, 0);

            const pendingDays = emp.vacations.reduce((sum, v) => {
                if (v.status !== 'PENDING') return sum;
                return sum + calculateVacationOverlapDays(v, year);
            }, 0);

            const availableDays = roundVacationValue(totalEntitled - importedUsed - approvedUsedDays);
            const projectedAvailable = roundVacationValue(availableDays - pendingDays + advanced);

            return {
                id: emp.id,
                name: emp.name,
                department: emp.department,
                annualQuotaDays: roundVacationValue(quota),
                carriedOverDays: roundVacationValue(carriedOver),
                importedUsedDays: roundVacationValue(importedUsed),
                approvedUsedDays: roundVacationValue(approvedUsedDays),
                pendingDays: roundVacationValue(pendingDays),
                totalQuota: totalEntitled,
                usedDays: roundVacationValue(importedUsed + approvedUsedDays),
                remainingDays: availableDays,
                projectedRemainingDays: projectedAvailable,
                requests: emp.vacations.length,
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
