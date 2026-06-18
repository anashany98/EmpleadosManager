import { prisma } from '../lib/prisma';
import { loggers } from './LoggerService';
import { AuthUser } from '../types/express';
import { isGlobalAdmin } from '../utils/companyAccess';
import { Employee, InventoryItem, Vehicle, Prisma } from '@prisma/client';

type MedicalReviewWithEmployee = Prisma.MedicalReviewGetPayload<{ include: { employee: true } }>;
type DocumentWithEmployee = Prisma.DocumentGetPayload<{ include: { employee: true } }>;

const log = loggers.alert;

export class AlertService {
    private buildVisibilityWhere(user?: AuthUser) {
        if (!user) {
            return {};
        }

        if (isGlobalAdmin(user)) {
            return {};
        }

        if (user.role === 'employee' && user.employeeId) {
            return { employeeId: user.employeeId };
        }

        if (user.companyId) {
            return {
                employee: {
                    is: {
                        companyId: user.companyId
                    }
                }
            };
        }

        return {
            employeeId: '__none__'
        };
    }

    // Check for expiring contracts and generate alerts
    async generateContractAlerts() {
        log.info('Generating multi-category alerts (Document Semaphore)...');
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

        // 1. Contract End Date Alerts (cursor pagination)
        let cursor: string | undefined;
        do {
            const batch: Employee[] = await prisma.employee.findMany({
                where: {
                    contractEndDate: {
                        lte: thirtyDaysFromNow,
                        gte: now
                    },
                    active: true
                },
                take: 500,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
            });

            for (const emp of batch) {
                await this.createAlert({
                    employeeId: emp.id,
                    type: 'CONTRACT_EXPIRING',
                    severity: 'HIGH',
                    title: 'Contrato por vencer',
                    message: `El contrato de ${emp.name || 'Empleado'} vence el ${emp.contractEndDate?.toLocaleDateString()}. Considerar renovación.`,
                    actionUrl: `/employees/${emp.id}`
                });
            }

            cursor = batch.length === 500 ? batch[batch.length - 1].id : undefined;
        } while (cursor);

        // 2. DNI Expiration (cursor pagination)
        cursor = undefined;
        do {
            const batch: Employee[] = await prisma.employee.findMany({
                where: {
                    dniExpiration: {
                        lte: thirtyDaysFromNow,
                        gte: now
                    },
                    active: true
                },
                take: 500,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
            });

            for (const emp of batch) {
                await this.createAlert({
                    employeeId: emp.id,
                    type: 'DNI_EXPIRING',
                    severity: 'MEDIUM',
                    title: 'DNI por vencer',
                    message: `El DNI de ${emp.name || 'Empleado'} vence el ${emp.dniExpiration?.toLocaleDateString()}`,
                    actionUrl: `/employees/${emp.id}`
                });
            }

            cursor = batch.length === 500 ? batch[batch.length - 1].id : undefined;
        } while (cursor);

        // 3. Medical Review Expiration (cursor pagination)
        cursor = undefined;
        do {
            const batch: MedicalReviewWithEmployee[] = await prisma.medicalReview.findMany({
                where: {
                    nextReviewDate: {
                        lte: thirtyDaysFromNow,
                        gte: now
                    }
                },
                include: { employee: true },
                take: 500,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
            });

            for (const rev of batch) {
                await this.createAlert({
                    employeeId: rev.employeeId,
                    type: 'MEDICAL_REVIEW_EXPIRING',
                    severity: 'MEDIUM',
                    title: 'Revisión Médica pendiente',
                    message: `La próxima revisión médica de ${rev.employee.name} debería ser antes del ${rev.nextReviewDate?.toLocaleDateString()}`,
                    actionUrl: `/employees/${rev.employeeId}`
                });
            }

            cursor = batch.length === 500 ? batch[batch.length - 1].id : undefined;
        } while (cursor);

        // 4. Document Expiry (cursor pagination)
        cursor = undefined;
        do {
            const batch: DocumentWithEmployee[] = await prisma.document.findMany({
                where: {
                    expiryDate: {
                        lte: fifteenDaysFromNow,
                        gte: now
                    }
                },
                include: { employee: true },
                take: 500,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
            });

            for (const doc of batch) {
                await this.createAlert({
                    employeeId: doc.employeeId,
                    type: 'DOCUMENT_EXPIRING',
                    severity: 'LOW',
                    title: 'Documento caducado/por caducar',
                    message: `El documento "${doc.name}" de ${doc.employee.name} vence el ${doc.expiryDate?.toLocaleDateString()}`,
                    actionUrl: `/employees/${doc.employeeId}`
                });
            }

            cursor = batch.length === 500 ? batch[batch.length - 1].id : undefined;
        } while (cursor);
    }

    // Check for low stock and generate alerts
    async generateStockAlerts() {
        try {
            log.info('Generating stock alerts...');
            // Prisma doesn't support comparing two columns in 'where' clause directly.
            // We must fetch items and filter in memory.
            let cursor: string | undefined;
            do {
                const batch: InventoryItem[] = await prisma.inventoryItem.findMany({
                    take: 1000,
                    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
                });

                const lowStockItems = batch.filter(item => item.quantity <= item.minQuantity);

                for (const item of lowStockItems) {
                    await this.createAlert({
                        employeeId: undefined, // System alert
                        type: 'LOW_STOCK',
                        severity: 'HIGH',
                        title: 'Stock Bajo',
                        message: `El ítem de inventario "${item.name}" (${item.size || 'N/A'}) tiene stock bajo (${item.quantity}).`,
                        actionUrl: `/inventory`
                    });
                }

                cursor = batch.length === 1000 ? batch[batch.length - 1].id : undefined;
            } while (cursor);
        } catch (error) {
            log.error({ error }, 'Error generating stock alerts');
        }
    }

    async runAllChecks() {
        await this.generateContractAlerts();
        await this.generateStockAlerts();
        await this.generateVehicleAlerts();
    }

    // Check for vehicle maintenance, ITV, and insurance
    async generateVehicleAlerts() {
        try {
            log.info('Generating vehicle alerts...');
            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            // 1. ITV Expiration (cursor pagination)
            let cursor: string | undefined;
            do {
                const batch: Vehicle[] = await prisma.vehicle.findMany({
                    where: {
                        nextITVDate: {
                            lte: thirtyDaysFromNow,
                            gte: now
                        },
                        status: 'ACTIVE'
                    },
                    include: { employee: true },
                    take: 500,
                    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
                });

                for (const vehicle of batch) {
                    await this.createAlert({
                        employeeId: vehicle.employeeId || undefined,
                        type: 'VEHICLE_ITV',
                        severity: 'HIGH',
                        title: 'ITV Próxima',
                        message: `El vehículo ${vehicle.plate} (${vehicle.make} ${vehicle.model}) debe pasar la ITV antes del ${vehicle.nextITVDate?.toLocaleDateString()}.`,
                        actionUrl: `/assets?tab=vehicles`
                    });
                }

                cursor = batch.length === 500 ? batch[batch.length - 1].id : undefined;
            } while (cursor);

            // 2. Insurance Expiration (cursor pagination)
            cursor = undefined;
            do {
                const batch: Vehicle[] = await prisma.vehicle.findMany({
                    where: {
                        insuranceExpiry: {
                            lte: thirtyDaysFromNow,
                            gte: now
                        },
                        status: 'ACTIVE'
                    },
                    include: { employee: true },
                    take: 500,
                    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
                });

                for (const vehicle of batch) {
                    await this.createAlert({
                        employeeId: vehicle.employeeId || undefined,
                        type: 'VEHICLE_INSURANCE',
                        severity: 'HIGH',
                        title: 'Seguro por vencer',
                        message: `El seguro del vehículo ${vehicle.plate} vence el ${vehicle.insuranceExpiry?.toLocaleDateString()}.`,
                        actionUrl: `/assets?tab=vehicles`
                    });
                }

                cursor = batch.length === 500 ? batch[batch.length - 1].id : undefined;
            } while (cursor);

            // 3. Maintenance Logic (Mileage based - cursor pagination)
            cursor = undefined;
            do {
                const batch: Vehicle[] = await prisma.vehicle.findMany({
                    where: {
                        status: 'ACTIVE',
                        nextMaintenanceKm: {
                            not: null
                        }
                    },
                    include: { employee: true },
                    take: 500,
                    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
                });

                const vehiclesNeedingMaintenance = batch.filter((v: Vehicle) =>
                    v.nextMaintenanceKm && v.currentMileage >= (v.nextMaintenanceKm - 1000)
                );

                for (const vehicle of vehiclesNeedingMaintenance) {
                    // Safe to assert non-null because of filter
                    const nextKm = vehicle.nextMaintenanceKm!;
                    await this.createAlert({
                        employeeId: vehicle.employeeId || undefined,
                        type: 'VEHICLE_MAINTENANCE',
                        severity: 'MEDIUM',
                        title: 'Mantenimiento Próximo',
                        message: `El vehículo ${vehicle.plate} tiene ${vehicle.currentMileage}km. Mantenimiento programado a los ${nextKm}km.`,
                        actionUrl: `/assets?tab=vehicles`
                    });
                }

                cursor = batch.length === 500 ? batch[batch.length - 1].id : undefined;
            } while (cursor);
        } catch (error) {
            log.error({ error }, 'Error generating vehicle alerts');
        }
    }

    async createAlert(data: {
        employeeId?: string;
        type: string;
        severity: string;
        title: string;
        message: string;
        actionUrl?: string;
    }) {
        // Avoid duplicate alerts (same type/employee/title in last 24h)
        const existing = await prisma.alert.findFirst({
            where: {
                employeeId: data.employeeId,
                type: data.type,
                title: data.title, // Check title too for stock alerts distinction
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            }
        });

        if (!existing) {
            await prisma.alert.create({
                data: {
                    ...data,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expires in 7 days
                }
            });
            log.info({ title: data.title }, 'Alert created');
        }
    }

    async getUnreadAlerts(user: AuthUser) {
        return prisma.alert.findMany({
            where: {
                ...this.buildVisibilityWhere(user),
                isRead: false,
                isDismissed: false
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 100,
            include: {
                employee: {
                    select: {
                        name: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
    }

    async markAsRead(alertId: string, user?: AuthUser) {
        return prisma.alert.updateMany({
            where: {
                id: alertId,
                ...this.buildVisibilityWhere(user)
            },
            data: { isRead: true }
        });
    }

    async dismissAlert(alertId: string, user?: AuthUser) {
        return prisma.alert.updateMany({
            where: {
                id: alertId,
                ...this.buildVisibilityWhere(user)
            },
            data: { isDismissed: true }
        });
    }

    async markAllAsRead(user?: AuthUser) {
        return prisma.alert.updateMany({
            where: {
                ...this.buildVisibilityWhere(user),
                isRead: false,
                isDismissed: false
            },
            data: { isRead: true }
        });
    }

    async dismissAll(user?: AuthUser) {
        return prisma.alert.updateMany({
            where: {
                ...this.buildVisibilityWhere(user),
                isDismissed: false
            },
            data: { isDismissed: true }
        });
    }
}

export const alertService = new AlertService();