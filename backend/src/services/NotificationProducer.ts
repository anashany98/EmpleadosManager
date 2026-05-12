import { prisma } from '../lib/prisma';
import { createNotification } from '../controllers/NotificationController';
import { createLogger } from './LoggerService';

const log = createLogger('NotificationProducer');

export class NotificationProducer {
    async checkContractExpirations() {
        log.info('Checking for contract expirations...');

        const today = new Date();
        const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Find employees with contracts expiring within 30 days
        const expiringContracts = await prisma.employee.findMany({
            where: {
                active: true,
                contractEndDate: {
                    gte: today,
                    lte: in30Days
                }
            },
            include: {
                company: true
            }
        });

        for (const employee of expiringContracts) {
            if (!employee.companyId) continue;

            // Notify HR/Admin users for this company
            const admins = await prisma.user.findMany({
                where: {
                    employee: {
                        companyId: employee.companyId
                    },
                    role: { in: ['admin', 'hr'] },
                    isActive: true
                }
            });

            const daysLeft = Math.ceil(
                (employee.contractEndDate!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );

            for (const admin of admins) {
                await createNotification(
                    admin.id,
                    `Contrato por vencer - ${employee.name}`,
                    `El contrato de ${employee.firstName || employee.name} vence en ${daysLeft} días (${employee.contractEndDate?.toLocaleDateString('es-ES')})`,
                    'WARNING',
                    `/employees/${employee.id}`
                );
            }
        }

        log.info(`Found ${expiringContracts.length} contracts expiring soon`);
    }

    async checkVacationBalances() {
        log.info('Checking vacation balances...');

        // Get all employees with low vacation balance
        const employeesWithLowVacation = await prisma.employee.findMany({
            where: {
                active: true,
                vacationDaysTotal: { lt: 5 }
            },
            include: {
                company: true
            }
        });

        for (const employee of employeesWithLowVacation) {
            if (!employee.companyId) continue;

            const admins = await prisma.user.findMany({
                where: {
                    employee: {
                        companyId: employee.companyId
                    },
                    role: { in: ['admin', 'hr'] },
                    isActive: true
                }
            });

            for (const admin of admins) {
                await createNotification(
                    admin.id,
                    `Vacaciones bajas - ${employee.name}`,
                    `${employee.firstName || employee.name} tiene solo ${employee.vacationDaysTotal} días de vacaciones restantes`,
                    'INFO',
                    `/vacations?employee=${employee.id}`
                );
            }
        }

        log.info(`Checked ${employeesWithLowVacation.length} employees for vacation balance`);
    }

    async checkDniExpirations() {
        log.info('Checking for DNI expirations...');

        const today = new Date();
        const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        const expiringDnis = await prisma.employee.findMany({
            where: {
                active: true,
                dniExpiration: {
                    gte: today,
                    lte: in30Days
                }
            },
            include: {
                company: true
            }
        });

        for (const employee of expiringDnis) {
            if (!employee.companyId) continue;

            const admins = await prisma.user.findMany({
                where: {
                    employee: {
                        companyId: employee.companyId
                    },
                    role: { in: ['admin', 'hr'] },
                    isActive: true
                }
            });

            const daysLeft = Math.ceil(
                (employee.dniExpiration!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );

            for (const admin of admins) {
                await createNotification(
                    admin.id,
                    `DNI por vencer - ${employee.name}`,
                    `El DNI de ${employee.firstName || employee.name} vence en ${daysLeft} días`,
                    'WARNING',
                    `/employees/${employee.id}`
                );
            }
        }

        log.info(`Found ${expiringDnis.length} DNI expirations soon`);
    }

    async runAllChecks() {
        try {
            await this.checkContractExpirations();
            await this.checkVacationBalances();
            await this.checkDniExpirations();
            log.info('All notification checks completed');
        } catch (error) {
            log.error({ error }, 'Error running notification checks');
        }
    }
}

export const notificationProducer = new NotificationProducer();