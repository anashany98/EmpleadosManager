import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { createLogger } from '../services/LoggerService';

const log = createLogger('InsightController');

export class InsightController {
    async getDashboardInsights(req: Request, res: Response) {
        const { companyId } = req.query;
        try {
            const whereClause: any = { active: true };
            if (companyId) whereClause.companyId = String(companyId);

            const insights = [];

            // 1. Stats Insight (General)
            const activeEmployees = await prisma.employee.count({ where: whereClause });
            const companyName = companyId
                ? (await prisma.company.findUnique({ where: { id: String(companyId) } }))?.name
                : 'Todas las empresas';

            insights.push({
                type: 'STATS',
                severity: 'info',
                title: 'Resumen Personal',
                message: `Actualmente hay ${activeEmployees} empleados activos bajo ${companyName}.`
            });

            const now = new Date();

            // 2. Contract Expiration (Next 45 days)
            const contractThreshold = new Date();
            contractThreshold.setDate(now.getDate() + 45);

            const expiringContracts = await prisma.employee.count({
                where: {
                    ...whereClause,
                    contractEndDate: {
                        gte: now,
                        lte: contractThreshold
                    }
                }
            });

            if (expiringContracts > 0) {
                insights.push({
                    type: 'WARNING',
                    severity: 'warning',
                    title: 'Vencimiento de Contratos',
                    message: `Atención: ${expiringContracts} contratos vencen en los próximos 45 días.`
                });
            }

            // 3. Low Inventory Stock
            const lowStockItems = await prisma.inventoryItem.count({
                where: {
                    quantity: { lte: 5 }
                }
            });

            if (lowStockItems > 0) {
                insights.push({
                    type: 'ALERT',
                    severity: 'error',
                    title: 'Stock Bajo',
                    message: `Hay ${lowStockItems} artículos de inventario con stock bajo mínimos.`
                });
            }

            // 4. DNI Expiration (Next 30 days)
            const dniThreshold = new Date();
            dniThreshold.setDate(now.getDate() + 30);

            const expiringDni = await prisma.employee.count({
                where: {
                    ...whereClause,
                    dniExpiration: {
                        gte: now,
                        lte: dniThreshold
                    }
                }
            });

            if (expiringDni > 0) {
                insights.push({
                    type: 'WARNING',
                    severity: 'warning',
                    title: 'DNI por Caducar',
                    message: `Detectados ${expiringDni} empleados con el DNI próximo a caducar.`
                });
            }

            // 5. Medical Reviews
            const medicalThreshold = new Date();
            medicalThreshold.setDate(now.getDate() + 30);

            const pendingReviews = await prisma.medicalReview.count({
                where: {
                    employee: whereClause,
                    date: { lte: medicalThreshold, gte: now }
                }
            });

            if (pendingReviews > 0) {
                insights.push({
                    type: 'INFO',
                    severity: 'info',
                    title: 'Revisiones Médicas',
                    message: `Hay ${pendingReviews} revisiones médicas programadas para este mes.`
                });
            }

            // 6. Data Completion
            const incompleteData = await prisma.employee.count({
                where: {
                    ...whereClause,
                    OR: [
                        { socialSecurityNumber: null },
                        { iban: null }
                    ]
                }
            });

            if (incompleteData > 0) {
                insights.push({
                    type: 'INFO',
                    severity: 'info',
                    title: 'Completitud de Datos',
                    message: `Faltan datos (IBAN/SS) en ${incompleteData} fichas de empleado.`
                });
            }

            // 7. Anniversaries (Next 7 days)
            const anniversaryThreshold = new Date();
            anniversaryThreshold.setDate(now.getDate() + 7);

            const employees = await prisma.employee.findMany({
                where: { ...whereClause, entryDate: { not: null } },
                select: { id: true, firstName: true, lastName: true, entryDate: true }
            });

            const upcomingAnniversaries = employees.filter(emp => {
                if (!emp.entryDate) return false;
                const entry = new Date(emp.entryDate);
                const currentYear = now.getFullYear();
                let anniversary = new Date(currentYear, entry.getMonth(), entry.getDate());
                if (anniversary < now) {
                    anniversary.setFullYear(currentYear + 1);
                }
                return anniversary >= now && anniversary <= anniversaryThreshold;
            });

            if (upcomingAnniversaries.length > 0) {
                const names = upcomingAnniversaries.map(e => `${e.firstName} ${e.lastName}`).join(', ');
                insights.push({
                    type: 'SUCCESS',
                    severity: 'success',
                    title: 'Aniversarios Laborales',
                    message: `¡Celebramos el aniversario de: ${names} esta semana!`
                });
            }

            return ApiResponse.success(res, insights);
        } catch (error: any) {
            log.error({ error }, 'Error generating insights');
            return ApiResponse.error(res, 'Error al generar insights', 500);
        }
    }

    async getDepartmentAbsences(req: Request, res: Response) {
        try {
            const today = new Date();
            const firstDay = today.getDate() - today.getDay() + 1;
            const lastDay = firstDay + 6;

            const monday = new Date(today.setDate(firstDay));
            monday.setHours(0, 0, 0, 0);
            const sunday = new Date(today.setDate(lastDay));
            sunday.setHours(23, 59, 59, 999);

            const activeAbsences = await prisma.vacation.findMany({
                where: {
                    OR: [
                        { startDate: { lte: sunday }, endDate: { gte: monday } }
                    ]
                },
                include: {
                    employee: true
                }
            });

            const summary: Record<string, number> = {};
            activeAbsences.forEach((v: any) => {
                const dept = v.employee.department || 'Sin Departamento';
                summary[dept] = (summary[dept] || 0) + 1;
            });

            const result = Object.entries(summary).map(([name, count]) => ({
                name,
                count
            })).sort((a, b) => b.count - a.count);

            return ApiResponse.success(res, result);
        } catch (error: any) {
            log.error({ error }, 'Error fetching absences');
            return ApiResponse.error(res, 'Error al obtener ausencias', 500);
        }
    }

    async getUpcomingBirthdays(req: Request, res: Response) {
        try {
            const currentMonth = new Date().getMonth() + 1;
            const employees = await prisma.employee.findMany({
                where: { active: true },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    birthDate: true
                }
            });

            const upcoming = employees.filter(e => {
                if (!e.birthDate) return false;
                return (new Date(e.birthDate).getMonth() + 1) === currentMonth;
            }).sort((a, b) => {
                const dayA = new Date(a.birthDate!).getDate();
                const dayB = new Date(b.birthDate!).getDate();
                return dayA - dayB;
            });

            return ApiResponse.success(res, upcoming);
        } catch (error: any) {
            log.error({ error }, 'Error fetching birthdays');
            return ApiResponse.error(res, 'Error al obtener cumpleaños', 500);
        }
    }

    async getUpcomingCelebrations(req: Request, res: Response) {
        try {
            const today = new Date();
            const threshold = new Date();
            threshold.setDate(today.getDate() + 30); // Próximos 30 días

            const employees = await prisma.employee.findMany({
                where: { active: true },
                select: {
                    id: true,
                    name: true,
                    firstName: true,
                    lastName: true,
                    birthDate: true,
                    entryDate: true
                }
            });

            const celebrations: any[] = [];

            employees.forEach(emp => {
                // Fallback for name display
                const displayName = (emp.firstName && emp.lastName)
                    ? `${emp.firstName} ${emp.lastName}`
                    : (emp.name || 'Empleado');

                if (emp.birthDate) {
                    const bday = new Date(emp.birthDate);
                    const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());

                    // Si ya pasó este año, mirar el que viene
                    if (thisYearBday < today) {
                        thisYearBday.setFullYear(today.getFullYear() + 1);
                    }

                    if (thisYearBday <= threshold) {
                        celebrations.push({
                            id: emp.id,
                            firstName: displayName,
                            lastName: '',
                            date: thisYearBday,
                            originalDate: emp.birthDate,
                            type: 'BIRTHDAY',
                            description: 'Cumpleaños'
                        });
                    }
                }

                if (emp.entryDate) {
                    const entry = new Date(emp.entryDate);
                    const thisYearAnniv = new Date(today.getFullYear(), entry.getMonth(), entry.getDate());

                    if (thisYearAnniv < today) {
                        thisYearAnniv.setFullYear(today.getFullYear() + 1);
                    }

                    if (thisYearAnniv <= threshold && thisYearAnniv.getFullYear() > entry.getFullYear()) {
                        const years = thisYearAnniv.getFullYear() - entry.getFullYear();
                        celebrations.push({
                            id: emp.id,
                            firstName: displayName,
                            lastName: '',
                            date: thisYearAnniv,
                            originalDate: emp.entryDate,
                            type: 'ANNIVERSARY',
                            years: years,
                            description: `${years} ${years === 1 ? 'año' : 'años'} en la empresa`
                        });
                    }
                }
            });

            celebrations.sort((a, b) => a.date.getTime() - b.date.getTime());

            return ApiResponse.success(res, celebrations);
        } catch (error: any) {
            log.error({ error }, 'Error fetching celebrations');
            return ApiResponse.error(res, 'Error al obtener celebraciones', 500);
        }
    }
    async getTurnoverRate(req: Request, res: Response) {
        // (Leavers / ((Start + End)/2)) * 100
        try {
            const now = new Date();
            const startOfPeriod = new Date();
            startOfPeriod.setFullYear(now.getFullYear() - 1); // Last 12 months

            // Active at start: (Entry < Start) AND (Exit is NULL OR Exit > Start)
            const startCount = await prisma.employee.count({
                where: {
                    entryDate: { lte: startOfPeriod },
                    OR: [
                        { exitDate: null },
                        { exitDate: { gt: startOfPeriod } }
                    ]
                }
            });

            // Active at end: (Entry < Now) AND (Exit is NULL OR Exit > Now)
            const endCount = await prisma.employee.count({
                where: {
                    entryDate: { lte: now },
                    OR: [
                        { exitDate: null },
                        { exitDate: { gt: now } }
                    ]
                }
            });

            // Leavers: Exit between Start and Now
            const leavers = await prisma.employee.count({
                where: {
                    exitDate: {
                        gte: startOfPeriod,
                        lte: now
                    }
                }
            });

            const avg = (startCount + endCount) / 2;
            const rate = avg === 0 ? 0 : ((leavers / avg) * 100);

            return ApiResponse.success(res, {
                rate: Number(rate.toFixed(2)),
                leavers,
                averageHeadcount: Number(avg.toFixed(1)),
                period: 'Últimos 12 meses'
            });

        } catch (error: any) {
            log.error({ error }, 'Error calculating turnover');
            return ApiResponse.error(res, 'Error al calcular rotación', 500);
        }
    }

    async getAbsenteeismRate(req: Request, res: Response) {
        // (Total Absence Days / Total Workable Days) * 100
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

            const totalEmployees = await prisma.employee.count({ where: { active: true } });

            // Approximate working days in month (Total Emps * 21 days)
            // This is a simplified estimation.
            const workableDays = totalEmployees * 21;

            // Fetch Sick/Absence vacations in this month
            const absences = await prisma.vacation.findMany({
                where: {
                    type: { in: ['SICK', 'ABSENCE', 'UNPAID'] },
                    startDate: { lte: endOfMonth },
                    endDate: { gte: startOfMonth }
                }
            });

            let totalAbsenceDays = 0;
            absences.forEach(abs => {
                // Calculate overlap with current month
                const start = abs.startDate < startOfMonth ? startOfMonth : abs.startDate;
                const end = abs.endDate > endOfMonth ? endOfMonth : abs.endDate;
                const diff = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
                totalAbsenceDays += diff;
            });

            const rate = workableDays === 0 ? 0 : ((totalAbsenceDays / workableDays) * 100);

            return ApiResponse.success(res, {
                rate: Number(rate.toFixed(2)),
                totalAbsenceDays: Math.round(totalAbsenceDays),
                workableDays,
                period: 'Mes actual'
            });

        } catch (error: any) {
            log.error({ error }, 'Error calculating absenteeism');
            return ApiResponse.error(res, 'Error al calcular absentismo', 500);
        }
    }

    async getCostByDepartment(req: Request, res: Response) {
        try {
            // Aggregate from PayrollRow linked to Employee
            const employees = await prisma.employee.findMany({
                where: { active: true },
                select: { id: true, department: true }
            });

            // Hack: Grouping by Prisma is tricky with relations sometimes, manual agg for now
            // Or aggregate payroll rows directly? PayrollRow has employeeId.
            // We need Department from Employee.
            // Let's fetch all payrolls from last month (most representative)

            // For now, let's assume we want ALL TIME or Year To Date. Let's do YTD.
            const currentYear = new Date().getFullYear();

            const payrolls = await prisma.payrollRow.findMany({
                where: {
                    batch: {
                        year: currentYear
                    }
                },
                include: {
                    employee: { select: { department: true } }
                }
            });

            const costMap: Record<string, number> = {};

            payrolls.forEach(row => {
                const dept = row.employee?.department || 'Sin Departamento';
                // Use 'bruto' + 'ssEmpresa' for total company cost
                const totalCost = Number(row.bruto) + Number(row.ssEmpresa);
                costMap[dept] = (costMap[dept] || 0) + totalCost;
            });

            const result = Object.entries(costMap).map(([name, value]) => ({
                name,
                value
            })).sort((a, b) => b.value - a.value);

            return ApiResponse.success(res, result);

        } catch (error: any) {
            log.error({ error }, 'Error calculating costs');
            return ApiResponse.error(res, 'Error al calcular costes', 500);
        }
    }
}
