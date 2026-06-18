import { prisma } from '../lib/prisma';
import { NotificationService } from './NotificationService';
import { createLogger } from './LoggerService';

const log = createLogger('NotificationProducer');

export class NotificationProducer {
    async checkContractExpirations() {
        log.info('Checking for contract expirations...');

        const today = new Date();
        const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Find employees with contracts expiring within 30 days (cursor pagination)
        let cursor: string | undefined;
        do {
            const batch = await prisma.employee.findMany({
                where: {
                    active: true,
                    contractEndDate: {
                        gte: today,
                        lte: in30Days
                    }
                },
                include: {
                    company: true
                },
                take: 500,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
            });

            for (const employee of batch) {
                if (!employee.companyId) continue;

                // Notify HR/Admin users for this company
                const admins = await prisma.user.findMany({
                    where: {
                        employee: {
                            companyId: employee.companyId
                        },
                        role: { in: ['admin', 'hr'] },
                        isActive: true
                    },
                    take: 100
                });

                const daysLeft = Math.ceil(
                    (employee.contractEndDate!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                );

                for (const admin of admins) {
                    await NotificationService.create({
                        userId: admin.id,
                        title: `Contrato por vencer - ${employee.name}`,
                        message: `El contrato de ${employee.firstName || employee.name} vence en ${daysLeft} días (${employee.contractEndDate?.toLocaleDateString('es-ES')})`,
                        type: 'WARNING',
                        link: `/employees/${employee.id}`
                    });
                }
            }

            cursor = batch.length === 500 ? batch[batch.length - 1].id : undefined;
        } while (cursor);

        log.info(`Checked contract expirations with cursor pagination`);
    }

    async checkVacationBalances() {
        log.info('Checking vacation balances...');

        // Get all employees with low vacation balance (cursor pagination)
        let cursor: string | undefined;
        do {
            const batch = await prisma.employee.findMany({
                where: {
                    active: true,
                    vacationDaysTotal: { lt: 5 }
                },
                include: {
                    company: true
                },
                take: 500,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
            });

            for (const employee of batch) {
                if (!employee.companyId) continue;

                const admins = await prisma.user.findMany({
                    where: {
                        employee: {
                            companyId: employee.companyId
                        },
                        role: { in: ['admin', 'hr'] },
                        isActive: true
                    },
                    take: 100
                });

                for (const admin of admins) {
                    await NotificationService.create({
                        userId: admin.id,
                        title: `Vacaciones bajas - ${employee.name}`,
                        message: `${employee.firstName || employee.name} tiene solo ${employee.vacationDaysTotal} días de vacaciones restantes`,
                        type: 'INFO',
                        link: `/vacations?employee=${employee.id}`
                    });
                }
            }

            cursor = batch.length === 500 ? batch[batch.length - 1].id : undefined;
        } while (cursor);

        log.info(`Checked vacation balances with cursor pagination`);
    }

    async checkDniExpirations() {
        log.info('Checking for DNI expirations...');

        const today = new Date();
        const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Find employees with expiring DNI (cursor pagination)
        let cursor: string | undefined;
        do {
            const batch = await prisma.employee.findMany({
                where: {
                    active: true,
                    dniExpiration: {
                        gte: today,
                        lte: in30Days
                    }
                },
                include: {
                    company: true
                },
                take: 500,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
            });

            for (const employee of batch) {
                if (!employee.companyId) continue;

                const admins = await prisma.user.findMany({
                    where: {
                        employee: {
                            companyId: employee.companyId
                        },
                        role: { in: ['admin', 'hr'] },
                        isActive: true
                    },
                    take: 100
                });

                const daysLeft = Math.ceil(
                    (employee.dniExpiration!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                );

                for (const admin of admins) {
                    await NotificationService.create({
                        userId: admin.id,
                        title: `DNI por vencer - ${employee.name}`,
                        message: `El DNI de ${employee.firstName || employee.name} vence en ${daysLeft} días`,
                        type: 'WARNING',
                        link: `/employees/${employee.id}`
                    });
                }
            }

            cursor = batch.length === 500 ? batch[batch.length - 1].id : undefined;
        } while (cursor);

        log.info(`Checked DNI expirations with cursor pagination`);
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