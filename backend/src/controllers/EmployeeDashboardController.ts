import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { createLogger } from '../services/LoggerService';

const log = createLogger('EmployeeDashboardController');

export class EmployeeDashboardController {
    // GET /api/dashboard/employees - Get comprehensive employee metrics
    async getEmployeeMetrics(req: Request, res: Response) {
        try {
            const { companyId, range = '6M' } = req.query;
            const monthsToFetch = range === '1Y' ? 12 : 6;

            // Build where clause
            const where: any = {};
            if (companyId) {
                where.companyId = companyId as string;
            }

            // Get all employees
            const allEmployees = await prisma.employee.findMany({
                where,
                select: {
                    id: true,
                    active: true,
                    firstName: true,
                    lastName: true,
                    department: true,
                    contractType: true,
                    createdAt: true,
                    entryDate: true,
                    dniExpiration: true,
                    drivingLicenseExpiration: true,
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

            // Document expiration alerts
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const dniExpiringDetails = activeEmployees
                .filter(e => e.dniExpiration && e.dniExpiration <= thirtyDaysFromNow && e.dniExpiration >= now)
                .map(e => ({
                    id: e.id,
                    name: `${e.firstName} ${e.lastName}`,
                    expiryDate: e.dniExpiration,
                    type: 'DNI'
                }));

            const licenseExpiringDetails = activeEmployees
                .filter(e => e.drivingLicenseExpiration && e.drivingLicenseExpiration <= thirtyDaysFromNow && e.drivingLicenseExpiration >= now)
                .map(e => ({
                    id: e.id,
                    name: `${e.firstName} ${e.lastName}`,
                    expiryDate: e.drivingLicenseExpiration,
                    type: 'LICENCIA'
                }));

            const medicalReviewsExpiring = await prisma.medicalReview.findMany({
                where: {
                    nextReviewDate: {
                        lte: thirtyDaysFromNow,
                        gte: now
                    },
                    employee: where
                },
                include: { employee: true }
            });

            const medicalExpiringDetails = medicalReviewsExpiring.map(r => ({
                id: r.employeeId,
                name: r.employee.name || `${r.employee.firstName} ${r.employee.lastName}`,
                expiryDate: r.nextReviewDate,
                type: 'MEDICA'
            }));

            const contracts = {
                expiring30: 0,
                expiring60: 0,
                expiring90: 0,
                trialPeriodEnding: 0,
                dniExpiring: dniExpiringDetails.length,
                licenseExpiring: licenseExpiringDetails.length,
                medicalReviewExpiring: medicalExpiringDetails.length,
                details: [...dniExpiringDetails, ...licenseExpiringDetails, ...medicalExpiringDetails]
            };

            // Financial overview - simplified without baseSalary field
            const financial = {
                totalBaseSalary: 0,
                avgSalary: 0,
                overtimeCostThisMonth: 0,
                employeesWithSalary: 0
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
                    employee: {
                        select: {
                            id: true,
                            name: true,
                            firstName: true,
                            lastName: true,
                            department: true
                        }
                    }
                }
            });

            const onLeaveToday = {
                count: vacationsToday.length,
                details: vacationsToday.map(v => ({
                    id: v.employee.id,
                    name: v.employee.name || `${v.employee.firstName} ${v.employee.lastName}`,
                    department: v.employee.department,
                    type: v.type, // VACATION, DAY_OFF, SICK_LEAVE, etc.
                    returnDate: v.endDate
                }))
            };

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

            // Growth trend
            const growthTrend = [];
            for (let i = monthsToFetch - 1; i >= 0; i--) {
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
                    month: monthDate.toLocaleString('es-ES', { month: 'short', year: 'numeric' }),
                    count: employeesAtMonth
                });
            }

            return ApiResponse.success(res, {
                headcount,
                contracts,
                financial,
                attendance,
                growthTrend
            });
        } catch (error: any) {
            log.error({ error }, 'Error fetching employee metrics');
            return ApiResponse.error(res, 'Failed to fetch employee metrics', 500);
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
