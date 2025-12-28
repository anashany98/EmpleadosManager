import { prisma } from '../lib/prisma';

export class ReportService {
    /**
     * Gets attendance data for a specific date range and optional filters.
     */
    static async getAttendanceData(start: Date, end: Date, filters: any = {}) {
        const where: any = {
            date: {
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
            orderBy: [{ date: 'asc' }, { checkIn: 'asc' }]
        });

        return entries;
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
     * Gets total company cost (Salary + SS Empresa) from payroll data.
     */
    static async getCompanyCostData(year: number, month?: number, filters: any = {}) {
        const where: any = {};
        if (month) where.month = month;
        where.year = year;

        const batches = await prisma.payrollImportBatch.findMany({
            where,
            include: {
                rows: {
                    include: {
                        employee: true
                    }
                }
            }
        });

        // Flatten and aggregate by employee
        const costByEmployee: Record<string, any> = {};

        batches.forEach(batch => {
            batch.rows.forEach(row => {
                const empName = row.rawEmployeeName || row.employee?.name || 'Desconocido';
                const key = row.employeeId || empName;

                if (!costByEmployee[key]) {
                    costByEmployee[key] = {
                        name: empName,
                        dni: row.employee?.dni || '-',
                        department: row.employee?.department || '-',
                        bruto: 0,
                        ssEmpresa: 0,
                        ssTrabajador: 0,
                        irpf: 0,
                        neto: 0,
                        totalCost: 0
                    };
                }

                costByEmployee[key].bruto += Number(row.bruto);
                costByEmployee[key].ssEmpresa += Number(row.ssEmpresa);
                costByEmployee[key].ssTrabajador += Number(row.ssTrabajador);
                costByEmployee[key].irpf += Number(row.irpf);
                costByEmployee[key].neto += Number(row.neto);
                costByEmployee[key].totalCost += Number(row.bruto) + Number(row.ssEmpresa);
            });
        });

        return Object.values(costByEmployee);
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

        // Approximate working days in the month (e.g. 21)
        const workingDaysInMonth = 21;
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
        const workingDays = 21;

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
        const where: any = { active: true };
        if (filters.companyId) where.companyId = filters.companyId;

        const employees = await prisma.employee.findMany({
            where,
            include: {
                payrollRows: {
                    where: { status: 'OK' },
                    orderBy: { batch: { createdAt: 'desc' } },
                    take: 12 // Last year to average
                }
            }
        });

        const stats: Record<string, any> = {
            'MALE': { count: 0, totalSalary: 0, avgSalary: 0 },
            'FEMALE': { count: 0, totalSalary: 0, avgSalary: 0 },
            'OTHER': { count: 0, totalSalary: 0, avgSalary: 0 },
            'UNKNOWN': { count: 0, totalSalary: 0, avgSalary: 0 }
        };

        employees.forEach(emp => {
            const gender = emp.gender || 'UNKNOWN';
            // Simple average of last year's bruto
            const totalBruto = emp.payrollRows.reduce((sum, row) => sum + Number(row.bruto), 0);
            const avgBruto = emp.payrollRows.length > 0 ? totalBruto / emp.payrollRows.length : 0;

            if (!stats[gender]) stats[gender] = { count: 0, totalSalary: 0, avgSalary: 0 };

            stats[gender].count++;
            stats[gender].totalSalary += avgBruto;
        });

        Object.keys(stats).forEach(g => {
            if (stats[g].count > 0) {
                stats[g].avgSalary = stats[g].totalSalary / stats[g].count;
            }
        });

        // Calculate gap (Male vs Female)
        let gapPercentage = 0;
        if (stats['MALE'].count > 0 && stats['FEMALE'].count > 0 && stats['MALE'].avgSalary > 0) {
            gapPercentage = ((stats['MALE'].avgSalary - stats['FEMALE'].avgSalary) / stats['MALE'].avgSalary) * 100;
        }

        return {
            breakdown: stats,
            gapPercentage: Number(gapPercentage.toFixed(2)),
            totalEmployees: employees.length
        };
    }
}
