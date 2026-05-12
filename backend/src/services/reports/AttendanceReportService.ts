import { prisma } from '../../lib/prisma';
import { PaginationParams, getPrismaPagination } from '../../utils/pagination';
import { CacheService } from '../CacheService';
import { CacheKeys } from '../../utils/cacheKeys';

// Cache TTL in seconds - short because attendance data changes frequently
const ATTENDANCE_CACHE_TTL = 60; // 1 minute

export class AttendanceReportService {
    /**
     * Gets attendance data for a specific date range and optional filters.
     * Results are cached when pagination is requested (for paginated queries).
     */
    static async getAttendanceData(start: Date, end: Date, filters: any = {}, pagination?: PaginationParams) {
        // Only cache when pagination is provided (caller explicitly wants a subset of data)
        if (pagination) {
            const companyId = filters.companyId || 'global';
            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];
            const cacheKey = CacheKeys.attendance(companyId, startStr, endStr);

            return CacheService.wrap(cacheKey, async () => this.computeAttendanceData(start, end, filters, pagination), ATTENDANCE_CACHE_TTL);
        }

        // No cache for non-paginated queries (full dataset)
        return this.computeAttendanceData(start, end, filters, pagination);
    }

    /**
     * Computes the actual attendance data.
     */
    private static async computeAttendanceData(start: Date, end: Date, filters: any = {}, pagination?: PaginationParams) {
        const where: any = {
            timestamp: {
                gte: start,
                lte: end
            }
        };

        if (filters.companyId) where.employee = { companyId: filters.companyId };
        if (filters.department) where.employee = { ...where.employee, department: filters.department };

        const _ = pagination ? getPrismaPagination(pagination) : {};

        const [total, entries] = await Promise.all([
            prisma.timeEntry.count({ where }),
            prisma.timeEntry.findMany({
                where,
                include: {
                    employee: {
                        select: {
                            id: true,
                            name: true,
                            firstName: true,
                            lastName: true,
                            dni: true,
                            department: true,
                            subaccount465: true
                        }
                    }
                },
                orderBy: [{ timestamp: 'asc' }],
                ..._
            })
        ]);

        return { data: entries, total };
    }

    /**
     * Gets attendance report grouped by employee with summary statistics.
     * Useful for generating attendance reports per employee.
     */
    static async getAttendanceByEmployee(start: Date, end: Date, filters: { companyId?: string; department?: string } = {}, pagination?: PaginationParams) {
        const where: any = {
            timestamp: { gte: start, lte: end }
        };

        if (filters.companyId) where.employee = { companyId: filters.companyId };
        if (filters.department) where.employee = { ...where.employee, department: filters.department };

        if (pagination) getPrismaPagination(pagination);

        const employees = await prisma.employee.findMany({
            where: {
                timeEntries: { some: where },
                ...(filters.companyId ? { companyId: filters.companyId } : {}),
                ...(filters.department ? { department: filters.department } : {})
            },
            select: { id: true, name: true, firstName: true, lastName: true, dni: true, department: true }
        });

        const report = await Promise.all(employees.map(async (emp) => {
            const entries = await prisma.timeEntry.findMany({
                where: {
                    employeeId: emp.id,
                    timestamp: { gte: start, lte: end }
                },
                orderBy: { timestamp: 'asc' }
            });

            // Calculate total hours and days worked
            let totalMs = 0;
            let lastIn: Date | null = null;
            const daysWorked = new Set<string>();

            entries.forEach((e) => {
                const day = e.timestamp.toISOString().split('T')[0];
                daysWorked.add(day);

                if (e.type === 'IN' || e.type === 'BREAK_END' || e.type === 'LUNCH_END') {
                    lastIn = e.timestamp;
                } else if (e.type === 'OUT' || e.type === 'BREAK_START' || e.type === 'LUNCH_START') {
                    if (lastIn) {
                        totalMs += e.timestamp.getTime() - lastIn.getTime();
                        lastIn = null;
                    }
                }
            });

            return {
                employeeId: emp.id,
                employeeName: emp.firstName && emp.lastName ? `${emp.firstName} ${emp.lastName}` : (emp.name || 'Empleado'),
                employeeDni: emp.dni || null,
                department: emp.department || null,
                totalHours: Number((totalMs / (1000 * 60 * 60)).toFixed(2)),
                daysWorked: daysWorked.size,
                totalEntries: entries.length,
                firstEntry: entries.length > 0 ? entries[0].timestamp : null,
                lastEntry: entries.length > 0 ? entries[entries.length - 1].timestamp : null
            };
        }));

        return { data: report, total: report.length };
    }

    /**
     * Calculates daily summaries for employees, pairing IN/OUT entries.
     */
    static async getAttendanceDailySummary(start: Date, end: Date, filters: { employeeId?: string; companyId?: string } = {}, pagination?: PaginationParams) {
        const where: any = {
            timestamp: { gte: start, lte: end }
        };

        if (filters.employeeId) where.employeeId = filters.employeeId;
        if (filters.companyId) where.employee = { companyId: filters.companyId };

        const prismaPagination = pagination ? getPrismaPagination(pagination) : {};

        const entries = await prisma.timeEntry.findMany({
            where,
            include: {
                employee: {
                    select: { id: true, name: true, firstName: true, lastName: true, dni: true, department: true }
                }
            },
            orderBy: [{ employeeId: 'asc' }, { timestamp: 'asc' }],
            ...prismaPagination
        });

        const summaries: any[] = [];
        const entriesByEmployee: Record<string, typeof entries> = {};

        // Group by employee
        entries.forEach(e => {
            if (!entriesByEmployee[e.employeeId]) entriesByEmployee[e.employeeId] = [];
            entriesByEmployee[e.employeeId].push(e);
        });

        for (const empId in entriesByEmployee) {
            const empEntries = entriesByEmployee[empId];
            const empInfo = empEntries[0].employee;

            // Group by day (YYYY-MM-DD)
            const byDay: Record<string, typeof entries> = {};
            empEntries.forEach(e => {
                const day = e.timestamp.toISOString().split('T')[0];
                if (!byDay[day]) byDay[day] = [];
                byDay[day].push(e);
            });

            for (const day in byDay) {
                const dayEntries = byDay[day];
                let totalMs = 0;
                let lastIn: Date | null = null;
                const segments: any[] = [];
                let hasIncomplete = false;

                dayEntries.forEach((e) => {
                    if (e.type === 'IN' || e.type === 'BREAK_END' || e.type === 'LUNCH_END') {
                        lastIn = e.timestamp;
                    } else if (e.type === 'OUT' || e.type === 'BREAK_START' || e.type === 'LUNCH_START') {
                        if (lastIn) {
                            const diff = e.timestamp.getTime() - lastIn.getTime();
                            totalMs += diff;
                            segments.push({
                                start: lastIn,
                                end: e.timestamp,
                                type: e.type.includes('BREAK') ? 'BREAK' : (e.type.includes('LUNCH') ? 'LUNCH' : 'WORK')
                            });
                            lastIn = null;
                        } else {
                            // OUT without IN
                            hasIncomplete = true;
                        }
                    }
                });

                // Check if still clocked in at end of record list for that day
                if (lastIn) {
                    const isToday = new Date().toISOString().split('T')[0] === day;
                    if (!isToday) hasIncomplete = true;

                    segments.push({
                        start: lastIn,
                        end: null,
                        type: 'ACTIVE'
                    });
                }

                summaries.push({
                    employeeId: empId,
                    employeeName: empInfo.firstName && empInfo.lastName ? `${empInfo.firstName} ${empInfo.lastName}` : (empInfo.name || 'Empleado'),
                    employeeDni: empInfo.dni || null,
                    department: empInfo.department || null,
                    date: day,
                    totalHours: Number((totalMs / (1000 * 60 * 60)).toFixed(2)),
                    status: hasIncomplete ? 'INCOMPLETE' : 'COMPLETE',
                    segments
                });
            }
        }

        return summaries;
    }
}
