import { prisma } from '../lib/prisma';
import { createLogger } from './LoggerService';

const log = createLogger('AnalyticsService');

export interface KPIMetric {
    current: number;
    previous: number;
    trend: number;
    trendDirection: 'up' | 'down' | 'stable';
}

export interface AnalyticsFilters {
    companyId?: string;
    department?: string;
    startDate?: Date;
    endDate?: Date;
}

export class AnalyticsService {
    /**
     * Get main KPIs for the dashboard
     */
    static async getMainKPIs(filters: AnalyticsFilters = {}): Promise<{
        totalEmployees: number;
        activeEmployees: number;
        newHires: number;
        departures: number;
        turnoverRate: number;
        avgTenure: number;
        openPositions: number;
        pendingRequests: number;
    }> {
        const { companyId } = filters;
        
        // Current period (last 30 days)
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        // Build where clause
        const companyFilter = companyId ? { companyId } : {};

        // Total employees (all time)
        const totalEmployees = await prisma.employee.count();
        
        // Active employees
        const activeEmployees = await prisma.employee.count({
            where: {
                active: true,
                ...companyFilter
            }
        });

        // New hires in last 30 days
        const newHires = await prisma.employee.count({
            where: {
                createdAt: { gte: thirtyDaysAgo }
            }
        });

        // Exits in last 30 days
        const departures = await prisma.employee.count({
            where: {
                active: false,
                ...companyFilter,
                updatedAt: {
                    gte: thirtyDaysAgo,
                    lte: now
                }
            }
        });

        // Turnover calculation
        const avgHeadcount = (totalEmployees + (totalEmployees - departures)) / 2 || 1;
        const turnoverRate = (departures / avgHeadcount) * 100;

        // Avg tenure (in years)
        const employees = await prisma.employee.findMany({
            where: { active: true },
            select: { entryDate: true }
        });
        
        let totalTenure = 0;
        let countWithDate = 0;
        employees.forEach(emp => {
            if (emp.entryDate) {
                const years = (now.getTime() - new Date(emp.entryDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
                totalTenure += years;
                countWithDate++;
            }
        });
        const avgTenure = countWithDate > 0 ? totalTenure / countWithDate : 0;

        // Open positions (placeholder - would need a JobPosition model)
        const openPositions = 0;

        // Pending requests (vacation requests pending)
        const pendingRequests = await prisma.vacation.count({
            where: {
                status: 'PENDING'
            }
        });

        return {
            totalEmployees,
            activeEmployees,
            newHires,
            departures,
            turnoverRate: Math.round(turnoverRate * 10) / 10,
            avgTenure: Math.round(avgTenure * 10) / 10,
            openPositions,
            pendingRequests
        };
    }

    /**
     * Get headcount trend over time
     */
    static async getHeadcountTrend(
        months: number = 12,
        filters: AnalyticsFilters = {}
    ): Promise<{ month: string; count: number; newHires: number; exits: number }[]> {
        const { companyId } = filters;
        const companyFilter = companyId ? { companyId } : {};
        
        const result = [];
        const now = new Date();

        for (let i = months - 1; i >= 0; i--) {
            const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

            // Active employees at end of month
            const count = await prisma.employee.count({
                where: {
                    active: true,
                    ...companyFilter,
                    createdAt: { lte: monthEnd }
                }
            });

            // New hires in month
            const newHires = await prisma.employee.count({
                where: {
                    ...companyFilter,
                    createdAt: {
                        gte: monthStart,
                        lte: monthEnd
                    }
                }
            });

            // Exits in month
            const exits = await prisma.employee.count({
                where: {
                    active: false,
                    ...companyFilter,
                    updatedAt: {
                        gte: monthStart,
                        lte: monthEnd
                    }
                }
            });

            result.push({
                month: monthStart.toISOString().slice(0, 7),
                count,
                newHires,
                exits
            });
        }

        return result;
    }

    /**
     * Get department breakdown
     */
    static async getDepartmentBreakdown(
        filters: AnalyticsFilters = {}
    ): Promise<{ department: string; count: number; percentage: number }[]> {
        const { companyId } = filters;
        const companyFilter = companyId ? { companyId } : {};

        const employees = await prisma.employee.findMany({
            where: {
                active: true,
                ...companyFilter
            },
            select: { department: true }
        });

        const total = employees.length;
        const breakdown: Record<string, number> = {};

        employees.forEach(emp => {
            const dept = emp.department || 'Sin Departamento';
            breakdown[dept] = (breakdown[dept] || 0) + 1;
        });

        return Object.entries(breakdown)
            .map(([department, count]) => ({
                department,
                count,
                percentage: total > 0 ? Math.round((count / total) * 100) : 0
            }))
            .sort((a, b) => b.count - a.count);
    }

    /**
     * Get absence heatmap data
     */
    static async getAbsenceHeatmap(
        year: number = new Date().getFullYear(),
        filters: AnalyticsFilters = {}
    ): Promise<{ dayOfWeek: number; month: number; count: number }[]> {
        const { companyId } = filters;
        const companyFilter = companyId ? { employee: { companyId } } : {};

        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31);

        const absences = await prisma.vacation.findMany({
            where: {
                type: { in: ['ABSENCE', 'SICK_LEAVE', 'VACATION'] },
                status: 'APPROVED',
                startDate: {
                    gte: startOfYear,
                    lte: endOfYear
                },
                ...companyFilter
            },
            select: { startDate: true, endDate: true }
        });

        // Count absences by day of week and month
        const heatmap: Record<string, number> = {};

        absences.forEach(absence => {
            const start = new Date(absence.startDate);
            const end = new Date(absence.endDate);
            
            // Iterate through each day of the absence
            const current = new Date(start);
            while (current <= end) {
                if (current.getFullYear() === year) {
                    const dayOfWeek = current.getDay();
                    const month = current.getMonth();
                    const key = `${dayOfWeek}-${month}`;
                    heatmap[key] = (heatmap[key] || 0) + 1;
                }
                current.setDate(current.getDate() + 1);
            }
        });

        // Convert to array format
        const result: { dayOfWeek: number; month: number; count: number }[] = [];
        for (let month = 0; month < 12; month++) {
            for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
                const key = `${dayOfWeek}-${month}`;
                result.push({
                    dayOfWeek,
                    month,
                    count: heatmap[key] || 0
                });
            }
        }

        return result;
    }

    /**
     * Get hiring funnel
     */
    static async getHiringFunnel(
        filters: AnalyticsFilters = {}
    ): Promise<{
        vacancies: number;
        applications: number;
        interviews: number;
        offers: number;
        hired: number;
    }> {
        const { companyId } = filters;
        const companyFilter = companyId ? { companyId } : {};

        // This is a simplified version - in a real system you'd have a proper ATS
        // For now, we'll use employee creation as a proxy for hiring
        
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const hired = await prisma.employee.count({
            where: {
                ...companyFilter,
                createdAt: { gte: thirtyDaysAgo }
            }
        });

        // Simulated funnel ratios (in a real system these would come from actual data)
        return {
            vacancies: Math.round(hired * 3), // ~3 vacancies per hire
            applications: Math.round(hired * 15), // ~15 applications per hire
            interviews: Math.round(hired * 5), // ~5 interviews per hire
            offers: Math.round(hired * 1.2), // ~1.2 offers per hire
            hired
        };
    }

    /**
     * Get overtime trends
     */
    static async getOvertimeTrend(
        months: number = 6,
        filters: AnalyticsFilters = {}
    ): Promise<{ month: string; hours: number; cost: number }[]> {
        const { companyId } = filters;
        const now = new Date();
        const result = [];

        for (let i = months - 1; i >= 0; i--) {
            const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

            const overtime = await prisma.overtimeEntry.aggregate({
                where: {
                    date: {
                        gte: monthStart,
                        lte: monthEnd
                    },
                    employee: companyId ? { companyId } : {}
                },
                _sum: {
                    hours: true,
                    total: true
                }
            });

            result.push({
                month: monthStart.toISOString().slice(0, 7),
                hours: overtime._sum.hours || 0,
                cost: overtime._sum.total || 0
            });
        }

        return result;
    }

    /**
     * Get tenure distribution
     */
    static async getTenureDistribution(
        filters: AnalyticsFilters = {}
    ): Promise<{ range: string; count: number }[]> {
        const { companyId } = filters;
        const companyFilter = companyId ? { companyId } : {};

        const employees = await prisma.employee.findMany({
            where: {
                active: true,
                ...companyFilter
            },
            select: { entryDate: true }
        });

        const now = new Date();
        const ranges: Record<string, number> = {
            '< 1 año': 0,
            '1-2 años': 0,
            '2-5 años': 0,
            '5-10 años': 0,
            '> 10 años': 0
        };

        employees.forEach(emp => {
            if (!emp.entryDate) {
                ranges['< 1 año']++;
                return;
            }

            const entryDate = new Date(emp.entryDate);
            const years = (now.getTime() - entryDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

            if (years < 1) ranges['< 1 año']++;
            else if (years < 2) ranges['1-2 años']++;
            else if (years < 5) ranges['2-5 años']++;
            else if (years < 10) ranges['5-10 años']++;
            else ranges['> 10 años']++;
        });

        return Object.entries(ranges).map(([range, count]) => ({ range, count }));
    }

    /**
     * Helper: Calculate trend metric
     */
    private static calculateTrend(current: number, previous: number): KPIMetric {
        const diff = current - previous;
        const percentage = previous !== 0 ? ((diff / previous) * 100) : 0;
        
        return {
            current: Math.round(current * 100) / 100,
            previous: Math.round(previous * 100) / 100,
            trend: Math.round(percentage * 10) / 10,
            trendDirection: diff > 0 ? 'up' : diff < 0 ? 'down' : 'stable'
        };
    }
}

export default AnalyticsService;
