import { Request, Response } from 'express';
import prisma from '../../database/prisma/client';

export class EmployeeDashboardController {
    // GET /api/dashboard/employees - Get comprehensive employee metrics
    async getEmployeeMetrics(req: Request, res: Response) {
        try {
            const { companyId } = req.query;

            // Build where clause
            const where: any = {};
            if (companyId) {
                where.companyId = companyId as string;
            }

            // Get all employees
            const allEmployees = await prisma.employee.findMany({
                where,
                include: {
                    vacations: {
                        where: {
                            startDate: {
                                gte: new Date(new Date().getFullYear(), 0, 1),
                                lte: new Date(new Date().getFullYear(), 11, 31)
                            }
                        }
                    },
                    overtimes: {
                        where: {
                            date: {
                                gte: new Date(new Date().setDate(1)) // This month
                            }
                        }
                    }
                }
            });

            const now = new Date();
            const activeEmployees = allEmployees.filter(e => e.active);

            // Headcount metrics
            const headcount = {
                total: allEmployees.length,
                active: activeEmployees.length,
                inactive: allEmployees.length - activeEmployees.length,
                byDepartment: this.groupByField(activeEmployees, 'department'),
                byContractType: this.groupByField(activeEmployees, 'contractType')
            };

            // Contract analytics
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
            const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

            const contracts = {
                expiring30: activeEmployees.filter(e =>
                    e.contractEndDate && e.contractEndDate <= thirtyDaysFromNow && e.contractEndDate >= now
                ).length,
                expiring60: activeEmployees.filter(e =>
                    e.contractEndDate && e.contractEndDate <= sixtyDaysFromNow && e.contractEndDate >= now
                ).length,
                expiring90: activeEmployees.filter(e =>
                    e.contractEndDate && e.contractEndDate <= ninetyDaysFromNow && e.contractEndDate >= now
                ).length,
                trialPeriodEnding: activeEmployees.filter(e =>
                    e.trialPeriodEndDate && e.trialPeriodEndDate <= thirtyDaysFromNow && e.trialPeriodEndDate >= now
                ).length
            };

            // Financial overview
            const employeesWithSalary = activeEmployees.filter(e => e.baseSalary);
            const totalBaseSalary = employeesWithSalary.reduce((sum, e) => sum + (e.baseSalary || 0), 0);
            const avgSalary = employeesWithSalary.length > 0 ? totalBaseSalary / employeesWithSalary.length : 0;

            // Calculate overtime cost this month
            const overtimeCost = allEmployees.reduce((sum, e) => {
                const empOvertimeCost = e.overtimes.reduce((s, o) => s + o.total, 0);
                return sum + empOvertimeCost;
            }, 0);

            const financial = {
                totalBaseSalary: Math.round(totalBaseSalary),
                avgSalary: Math.round(avgSalary),
                overtimeCostThisMonth: Math.round(overtimeCost),
                employeesWithSalary: employeesWithSalary.length
            };

            // Attendance metrics
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const vacationsToday = await prisma.vacation.findMany({
                where: {
                    AND: [
                        { startDate: { lte: tomorrow } },
                        { endDate: { gte: today } }
                    ],
                    employee: where
                },
                include: {
                    employee: true
                }
            });

            const onLeaveToday = vacationsToday.length;

            // Calculate absence rate (last 30 days)
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const vacationsLast30Days = await prisma.vacation.findMany({
                where: {
                    startDate: {
                        gte: thirtyDaysAgo
                    },
                    employee: where
                }
            });

            const totalAbsenceDays = vacationsLast30Days.reduce((sum, v) => {
                const start = new Date(v.startDate);
                const end = new Date(v.endDate);
                const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                return sum + days;
            }, 0);

            const totalWorkDays = activeEmployees.length * 30; // Approximate
            const absenceRate = totalWorkDays > 0 ? (totalAbsenceDays / totalWorkDays) * 100 : 0;

            const attendance = {
                absenceRate: Math.round(absenceRate * 10) / 10,
                onLeaveToday,
                totalAbsenceDaysLast30: totalAbsenceDays
            };

            // Growth trend (last 6 months)
            const growthTrend = [];
            for (let i = 5; i >= 0; i--) {
                const monthDate = new Date();
                monthDate.setMonth(monthDate.getMonth() - i);
                monthDate.setDate(1);
                monthDate.setHours(0, 0, 0, 0);

                const nextMonth = new Date(monthDate);
                nextMonth.setMonth(nextMonth.getMonth() + 1);

                const employeesAtMonth = await prisma.employee.count({
                    where: {
                        ...where,
                        createdAt: {
                            lt: nextMonth
                        }
                    }
                });

                growthTrend.push({
                    month: monthDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
                    count: employeesAtMonth
                });
            }

            res.json({
                headcount,
                contracts,
                financial,
                attendance,
                growthTrend
            });
        } catch (error: any) {
            console.error('Error fetching employee metrics:', error);
            res.status(500).json({ error: 'Failed to fetch employee metrics', details: error.message });
        }
    }

    private groupByField(employees: any[], field: string): Record<string, number> {
        return employees.reduce((acc, emp) => {
            const value = emp[field] || 'Sin asignar';
            acc[value] = (acc[value] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }
}

export const employeeDashboardController = new EmployeeDashboardController();
