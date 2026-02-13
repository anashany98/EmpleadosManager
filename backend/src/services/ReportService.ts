import { prisma } from '../lib/prisma';

export class ReportService {
    /**
     * Gets attendance data for a specific date range and optional filters.
     */
    static async getAttendanceData(start: Date, end: Date, filters: any = {}) {
        const where: any = {
            timestamp: {
                gte: start,
                lte: end
            }
        };

        if (filters.companyId) where.employee = { companyId: filters.companyId };
        if (filters.department) where.employee = { ...where.employee, department: filters.department };

        const entries = await prisma.timeEntry.findMany({
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
            orderBy: [{ timestamp: 'asc' }]
        });

        return entries;
    }

    /**
     * Calculates daily summaries for employees, pairing IN/OUT entries.
     */
    static async getAttendanceDailySummary(start: Date, end: Date, filters: { employeeId?: string; companyId?: string } = {}) {
        const where: any = {
            timestamp: { gte: start, lte: end }
        };

        if (filters.employeeId) where.employeeId = filters.employeeId;
        if (filters.companyId) where.employee = { companyId: filters.companyId };

        const entries = await prisma.timeEntry.findMany({
            where,
            include: {
                employee: {
                    select: { id: true, name: true, firstName: true, lastName: true }
                }
            },
            orderBy: [{ employeeId: 'asc' }, { timestamp: 'asc' }]
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
                    date: day,
                    totalHours: Number((totalMs / (1000 * 60 * 60)).toFixed(2)),
                    status: hasIncomplete ? 'INCOMPLETE' : 'COMPLETE',
                    segments
                });
            }
        }

        return summaries;
    }


    /**
     * Gets overtime data and calculated costs.
     */
    static async getOvertimeData(start: Date, end: Date, filters: any = {}) {
        const where: any = {
            date: {
                gte: start,
                lte: end
            }
        };

        if (filters.companyId) where.employee = { companyId: filters.companyId };
        if (filters.department) where.employee = { ...where.employee, department: filters.department };

        const entries = await prisma.overtimeEntry.findMany({
            where,
            include: {
                employee: true
            },
            orderBy: { date: 'asc' }
        });

        return entries;
    }

    /**
     * Gets vacation balance and history.
     */
    static async getVacationData(year: number, filters: any = {}) {
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59);

        const where: any = {};
        if (filters.companyId) where.companyId = filters.companyId;
        if (filters.department) where.department = filters.department;

        const employees = await prisma.employee.findMany({
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
            }
        });

        return employees.map(emp => {
            const usedDays = (emp.vacations as any[]).reduce((sum, v) => sum + (v.days || 0), 0);
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
    }

    /**
     * Gets total company cost (Salary + SS Empresa) from payroll data, optimized with aggregation.
     */
    static async getCompanyCostData(year: number, month?: number, filters: any = {}) {
        const whereBatch: any = { year };
        if (month) whereBatch.month = month;

        // 1. Get Batches IDs for the period
        const batches = await prisma.payrollImportBatch.findMany({
            where: whereBatch,
            select: { id: true }
        });
        const batchIds = batches.map(b => b.id);

        if (batchIds.length === 0) return [];

        // 2. Aggregate costs by Employee using Prisma groupBy
        const aggregatedCosts = await prisma.payrollRow.groupBy({
            by: ['employeeId'],
            where: {
                batchId: { in: batchIds }
            },
            _sum: {
                bruto: true,
                ssEmpresa: true,
                ssTrabajador: true,
                irpf: true,
                neto: true
            }
        });

        // 3. Enrich with Employee details
        // We need to fetch employee details manually since groupBy doesn't support 'include'
        const employeeIds = aggregatedCosts.map(c => c.employeeId).filter(id => id !== null) as string[];
        const employees = await prisma.employee.findMany({
            where: { id: { in: employeeIds } },
            select: { id: true, name: true, dni: true, department: true }
        });

        const employeeMap = new Map(employees.map(e => [e.id, e]));

        // 4. Format Result
        return aggregatedCosts.map(cost => {
            const emp = cost.employeeId ? employeeMap.get(cost.employeeId) : null;
            const bruto = Number(cost._sum.bruto || 0);
            const ssEmpresa = Number(cost._sum.ssEmpresa || 0);

            return {
                name: emp?.name || 'Desconocido',
                dni: emp?.dni || '-',
                department: emp?.department || '-',
                bruto,
                ssEmpresa,
                ssTrabajador: Number(cost._sum.ssTrabajador || 0),
                irpf: Number(cost._sum.irpf || 0),
                neto: Number(cost._sum.neto || 0),
                totalCost: bruto + ssEmpresa
            };
        });
    }

    /**
     * Gets detailed absences with duration and classification.
     */
    static async getDetailedAbsenceData(start: Date, end: Date, filters: any = {}) {
        const where: any = {
            startDate: { lte: end },
            endDate: { gte: start }
        };

        if (filters.companyId) where.employee = { companyId: filters.companyId };
        if (filters.department) where.employee = { ...where.employee, department: filters.department };

        const absences = await prisma.vacation.findMany({
            where,
            include: {
                employee: true
            },
            orderBy: { startDate: 'desc' }
        });

        return absences;
    }

    /**
     * Gets a summary of HR KPIs for a specific period.
     */
    static async getKPIMetrics(year: number, month: number, filters: any = {}) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        // 1. Employee Count (Start, End and Avg)
        const totalEmployees = await prisma.employee.count({
            where: {
                OR: [
                    { exitDate: null },
                    { exitDate: { gte: startDate } }
                ],
                entryDate: { lte: endDate },
                ...(filters.companyId ? { companyId: filters.companyId } : {})
            }
        });

        // 2. Turnover Data
        const hires = await prisma.employee.count({
            where: {
                entryDate: { gte: startDate, lte: endDate },
                ...(filters.companyId ? { companyId: filters.companyId } : {})
            }
        });

        const exits = await prisma.employee.count({
            where: {
                exitDate: { gte: startDate, lte: endDate },
                ...(filters.companyId ? { companyId: filters.companyId } : {})
            }
        });

        const turnoverRate = totalEmployees > 0 ? ((hires + exits) / 2) / totalEmployees * 100 : 0;

        // 3. Absenteeism Data
        const absences = await prisma.vacation.findMany({
            where: {
                startDate: { lte: endDate },
                endDate: { gte: startDate },
                type: { not: 'VACATION' }, // Regular vacations usually don't count as absenteeism
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
     */
    static async getAbsenteeismByDepartment(year: number, month: number, filters: any = {}) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const employees = await prisma.employee.findMany({
            where: {
                OR: [
                    { exitDate: null },
                    { exitDate: { gte: startDate } }
                ],
                entryDate: { lte: endDate },
                ...(filters.companyId ? { companyId: filters.companyId } : {})
            },
            include: {
                vacations: {
                    where: {
                        startDate: { lte: endDate },
                        endDate: { gte: startDate },
                        type: { not: 'VACATION' }
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
