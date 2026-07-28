import { prisma } from '../../lib/prisma';
import { CacheService } from '../CacheService';
import { CacheKeys } from '../../utils/cacheKeys';
import { VACATION_TYPES_FOR_BALANCE } from '../VacationBalanceService';

// Cache TTLs in seconds
const KPI_CACHE_TTL = 300; // 5 minutes
const ABSENTEEISM_CACHE_TTL = 300; // 5 minutes

export class HRMetricsService {
    /**
     * Gets a summary of HR KPIs for a specific period.
     * Results are cached per company/year/month.
     */
    static async getKPIMetrics(year: number, month: number, filters: any = {}) {
        const companyId = filters.companyId || 'global';
        const cacheKey = CacheKeys.kpis(companyId, year, month);

        return CacheService.wrap(cacheKey, async () => this.computeKPIMetrics(year, month, filters), KPI_CACHE_TTL);
    }

    /**
     * Computes the actual KPI metrics (called on cache miss).
     */
    private static async computeKPIMetrics(year: number, month: number, filters: any = {}) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        // 1. Employee Count (Start, End and Avg)
        const activePeriods = await prisma.employmentPeriod.findMany({
            where: {
                startDate: { lte: endDate },
                OR: [{ endDate: null }, { endDate: { gte: startDate } }],
                ...(filters.companyId ? { companyId: filters.companyId } : {})
            },
            select: { employeeId: true }
        });
        const totalEmployees = new Set(activePeriods.map((period) => period.employeeId)).size;

        // 2. Turnover Data
        const hires = await prisma.employmentPeriod.count({
            where: {
                startDate: { gte: startDate, lte: endDate },
                ...(filters.companyId ? { companyId: filters.companyId } : {})
            }
        });

        const exits = await prisma.employmentPeriod.count({
            where: {
                endDate: { gte: startDate, lte: endDate },
                ...(filters.companyId ? { companyId: filters.companyId } : {})
            }
        });

        const turnoverRate = totalEmployees > 0 ? ((hires + exits) / 2) / totalEmployees * 100 : 0;

        // 3. Absenteeism Data
        const absences = await prisma.vacation.findMany({
            where: {
                startDate: { lte: endDate },
                endDate: { gte: startDate },
                type: { notIn: VACATION_TYPES_FOR_BALANCE }, // Regular vacations don't count as absenteeism
                employee: filters.companyId ? { companyId: filters.companyId } : {}
            }
        });

        // Calculate real working days in the month
        const workingDaysInMonth = this.getWorkingDays(startDate, endDate);
        const totalPotentialDays = totalEmployees * workingDaysInMonth;
        const totalAbsenceDays = absences.reduce((sum, a: any) => sum + (a.days || 0), 0);
        const absenteeismRate = totalPotentialDays > 0 ? (totalAbsenceDays / totalPotentialDays) * 100 : 0;

        return {
            period: `${month}/${year}`,
            headcount: totalEmployees,
            hires,
            exits,
            turnoverRate: Number(turnoverRate.toFixed(2)),
            absenteeismRate: Number(absenteeismRate.toFixed(2)),
            totalAbsenceDays
        };
    }

    /**
     * Helper: Calculates working days (Mon-Fri) between two dates inclusive.
     */
    private static getWorkingDays(startDate: Date, endDate: Date): number {
        let count = 0;
        const curDate = new Date(startDate.getTime());
        while (curDate <= endDate) {
            const dayOfWeek = curDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0=Sun, 6=Sat
                count++;
            }
            curDate.setDate(curDate.getDate() + 1);
        }
        return count;
    }

    /**
     * Gets absenteeism breakdown by department.
     * Results are cached per company/year/month.
     */
    static async getAbsenteeismByDepartment(year: number, month: number, filters: any = {}) {
        const companyId = filters.companyId || 'global';
        const cacheKey = CacheKeys.absenteeism(companyId, year, month);

        return CacheService.wrap(cacheKey, async () => this.computeAbsenteeismByDepartment(year, month, filters), ABSENTEEISM_CACHE_TTL);
    }

    /**
     * Computes actual absenteeism data (called on cache miss).
     */
    private static async computeAbsenteeismByDepartment(year: number, month: number, filters: any = {}) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const employees = await prisma.employee.findMany({
            where: {
                employmentPeriods: {
                    some: {
                        startDate: { lte: endDate },
                        OR: [{ endDate: null }, { endDate: { gte: startDate } }]
                    }
                },
                ...(filters.companyId ? { companyId: filters.companyId } : {})
            },
            include: {
                vacations: {
                    where: {
                        startDate: { lte: endDate },
                        endDate: { gte: startDate },
                        type: { notIn: VACATION_TYPES_FOR_BALANCE }
                    }
                }
            }
        });

        const deptStats: Record<string, any> = {};
        const workingDays = this.getWorkingDays(startDate, endDate);

        employees.forEach(emp => {
            const dept = emp.department || 'Sin asignar';
            if (!deptStats[dept]) {
                deptStats[dept] = { department: dept, employees: 0, absenceDays: 0, potentialDays: 0 };
            }
            deptStats[dept].employees++;
            deptStats[dept].potentialDays += workingDays;
            deptStats[dept].absenceDays += emp.vacations.reduce((sum, v: any) => sum + (v.days || 0), 0);
        });

        return Object.values(deptStats).map((d: any) => ({
            ...d,
            rate: d.potentialDays > 0 ? Number(((d.absenceDays / d.potentialDays) * 100).toFixed(2)) : 0
        }));
    }

    /**
     * Gets gender gap data analysis.
     */
    static async getGenderGapData(filters: any = {}) {
        const where: any = {};
        if (filters.companyId) where.companyId = filters.companyId;

        const employees = await prisma.employee.findMany({
            where,
            include: {
                payrollRows: {
                    where: { status: 'OK' },
                    orderBy: { batch: { createdAt: 'desc' } },
                    take: 12 // Last 12 records
                }
            }
        });

        const deptStats: Record<string, any> = {};
        const globalStats = {
            maleCount: 0,
            femaleCount: 0,
            maleTotalBruto: 0,
            femaleTotalBruto: 0,
            maleAvgBruto: 0,
            femaleAvgBruto: 0,
            gapPercentage: 0
        };

        employees.forEach(emp => {
            const gender = emp.gender || 'UNKNOWN';
            const dept = emp.department || 'Sin asignar';

            // Calculate employee's average bruto
            const totalBruto = emp.payrollRows.reduce((sum, row) => sum + Number(row.bruto), 0);
            const avgBruto = emp.payrollRows.length > 0 ? totalBruto / emp.payrollRows.length : 0;

            // Global totals
            if (gender === 'MALE') {
                globalStats.maleCount++;
                globalStats.maleTotalBruto += avgBruto;
            } else if (gender === 'FEMALE') {
                globalStats.femaleCount++;
                globalStats.femaleTotalBruto += avgBruto;
            }

            // Department breakdown
            if (!deptStats[dept]) {
                deptStats[dept] = {
                    department: dept,
                    maleCount: 0,
                    femaleCount: 0,
                    maleTotal: 0,
                    femaleTotal: 0,
                    maleAvg: 0,
                    femaleAvg: 0,
                    gap: 0
                };
            }

            if (gender === 'MALE') {
                deptStats[dept].maleCount++;
                deptStats[dept].maleTotal += avgBruto;
            } else if (gender === 'FEMALE') {
                deptStats[dept].femaleCount++;
                deptStats[dept].femaleTotal += avgBruto;
            }
        });

        // Finalize averages and gaps
        globalStats.maleAvgBruto = globalStats.maleCount > 0 ? globalStats.maleTotalBruto / globalStats.maleCount : 0;
        globalStats.femaleAvgBruto = globalStats.femaleCount > 0 ? globalStats.femaleTotalBruto / globalStats.femaleCount : 0;

        if (globalStats.maleAvgBruto > 0) {
            globalStats.gapPercentage = Number(((globalStats.maleAvgBruto - globalStats.femaleAvgBruto) / globalStats.maleAvgBruto * 100).toFixed(2));
        }

        const rows = Object.values(deptStats).map((d: any) => {
            d.maleAvg = d.maleCount > 0 ? d.maleTotal / d.maleCount : 0;
            d.femaleAvg = d.femaleCount > 0 ? d.femaleTotal / d.femaleCount : 0;
            if (d.maleAvg > 0) {
                d.gap = Number(((d.maleAvg - d.femaleAvg) / d.maleAvg * 100).toFixed(2));
            }
            return d;
        });

        return {
            summary: globalStats,
            rows
        };
    }
}
