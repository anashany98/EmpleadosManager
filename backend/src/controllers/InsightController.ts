import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export class InsightController {
    async getDashboardInsights(req: Request, res: Response) {
        const { companyId } = req.query;
        try {
            const whereClause = companyId ? { companyId: String(companyId) } : {};

            const activeEmployees = await prisma.employee.count({
                where: { ...whereClause, active: true }
            });

            const companyName = companyId
                ? (await prisma.company.findUnique({ where: { id: String(companyId) } }))?.name
                : 'Todas las empresas';

            const insights = [];

            // 1. Stats Insight
            insights.push({
                type: 'STATS',
                title: 'Resumen Personal',
                message: `Actualmente hay ${activeEmployees} empleados activos bajo ${companyName}.`
            });

            // 2. Medical Reviews Insight (Real logic)
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

            const pendingReviews = await prisma.medicalReview.count({
                where: {
                    employee: whereClause,
                    date: { lte: thirtyDaysFromNow, gte: new Date() }
                }
            });

            if (pendingReviews > 0) {
                insights.push({
                    type: 'WARNING',
                    severity: 'warning',
                    title: 'Revisiones Médicas',
                    message: `Hay ${pendingReviews} revisiones médicas programadas para los próximos 30 días.`
                });
            }

            // 3. Data Completion
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
                    message: `Detectados ${incompleteData} empleados con datos bancarios o de SS incompletos.`
                });
            }

            res.json(insights);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error generating insights' });
        }
    }

    async getDepartmentAbsences(req: Request, res: Response) {
        try {
            const today = new Date();
            const firstDay = today.getDate() - today.getDay() + 1; // Monday
            const lastDay = firstDay + 6; // Sunday

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

            // Convert to array for frontend
            const result = Object.entries(summary).map(([name, count]) => ({
                name,
                count
            })).sort((a, b) => b.count - a.count);

            res.json(result);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error fetching absences' });
        }
    }

    async getUpcomingBirthdays(req: Request, res: Response) {
        try {
            const currentMonth = new Date().getMonth() + 1; // 1-12

            // Note: SQLite doesn't have a direct MONTH() function in a standard way through Prisma without raw queries
            // but we can fetch all and filter or use a raw query if needed.
            // For now, since the employee list is small (<100), we'll filter in JS.
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

            res.json(upcoming);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error fetching birthdays' });
        }
    }
}
