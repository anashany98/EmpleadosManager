import { prisma } from '../lib/prisma';
import { loggers } from './LoggerService';

const log = loggers.alert;

export class AlertService {
    // Check for expiring contracts and generate alerts
    async generateContractAlerts() {
        log.info('Generating multi-category alerts (Document Semaphore)...');
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

        // 1. Contract End Date Alerts
        const employeesWithExpiringContract = await prisma.employee.findMany({
            where: {
                contractEndDate: {
                    lte: thirtyDaysFromNow,
                    gte: now
                },
                active: true
            }
        });

        for (const emp of employeesWithExpiringContract) {
            await this.createAlert({
                employeeId: emp.id,
                type: 'CONTRACT_EXPIRING',
                severity: 'HIGH',
                title: 'Contrato por vencer',
                message: `El contrato de ${emp.name || 'Empleado'} vence el ${emp.contractEndDate?.toLocaleDateString()}. Considerar prórroga.`,
                actionUrl: `/employees/${emp.id}`
            });
        }

        // 2. DNI Expiration (Existing logic, slightly improved)
        const employeesWithExpiringDNI = await prisma.employee.findMany({
            where: {
                dniExpiration: {
                    lte: thirtyDaysFromNow,
                    gte: now
                },
                active: true
            }
        });

        for (const emp of employeesWithExpiringDNI) {
            await this.createAlert({
                employeeId: emp.id,
                type: 'DNI_EXPIRING',
                severity: 'MEDIUM',
                title: 'DNI por vencer',
                message: `El DNI de ${emp.name || 'Empleado'} vence el ${emp.dniExpiration?.toLocaleDateString()}`,
                actionUrl: `/employees/${emp.id}`
            });
        }

        // 3. Medical Review Expiration
        const expiringMedicalReviews = await prisma.medicalReview.findMany({
            where: {
                nextReviewDate: {
                    lte: thirtyDaysFromNow,
                    gte: now
                }
            },
            include: { employee: true }
        });

        for (const rev of expiringMedicalReviews) {
            await this.createAlert({
                employeeId: rev.employeeId,
                type: 'MEDICAL_REVIEW_EXPIRING',
                severity: 'MEDIUM',
                title: 'Revisión Médica pendiente',
                message: `La próxima revisión médica de ${rev.employee.name} debería ser antes del ${rev.nextReviewDate?.toLocaleDateString()}`,
                actionUrl: `/employees/${rev.employeeId}`
            });
        }

        // 4. Document Expiry (Generic documents)
        const expiringDocuments = await prisma.document.findMany({
            where: {
                expiryDate: {
                    lte: fifteenDaysFromNow,
                    gte: now
                }
            },
            include: { employee: true }
        });

        for (const doc of expiringDocuments) {
            await this.createAlert({
                employeeId: doc.employeeId,
                type: 'DOCUMENT_EXPIRING',
                severity: 'LOW',
                title: 'Documento caducado/por caducar',
                message: `El documento "${doc.name}" de ${doc.employee.name} vence el ${doc.expiryDate?.toLocaleDateString()}`,
                actionUrl: `/employees/${doc.employeeId}`
            });
        }
    }

    // Check for low stock and generate alerts
    async generateStockAlerts() {
        try {
            log.info('Generating stock alerts...');
            // Prisma doesn't support comparing two columns in 'where' clause directly.
            // We must fetch items and filter in memory.
            const allItems = await prisma.inventoryItem.findMany();

            const lowStockItems = allItems.filter(item => item.quantity <= item.minQuantity);

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

            // 1. ITV Expiration & 2. Insurance Expiration
            // Fetch relevant vehicles once if possible, or keep separate queries for clarity.
            // Since criteria are different (dates vs mileage), we can keep date queries as is (they are valid).

            // 1. ITV Expiration
            const vehiclesWithExpiringITV = await prisma.vehicle.findMany({
                where: {
                    nextITVDate: {
                        lte: thirtyDaysFromNow,
                        gte: now
                    },
                    status: 'ACTIVE'
                },
                include: { employee: true }
            });

            for (const vehicle of vehiclesWithExpiringITV) {
                await this.createAlert({
                    employeeId: vehicle.employeeId || undefined,
                    type: 'VEHICLE_ITV',
                    severity: 'HIGH',
                    title: 'ITV Próxima',
                    message: `El vehículo ${vehicle.plate} (${vehicle.make} ${vehicle.model}) debe pasar la ITV antes del ${vehicle.nextITVDate?.toLocaleDateString()}.`,
                    actionUrl: `/assets?tab=vehicles`
                });
            }

            // 2. Insurance Expiration
            const vehiclesWithExpiringInsurance = await prisma.vehicle.findMany({
                where: {
                    insuranceExpiry: {
                        lte: thirtyDaysFromNow,
                        gte: now
                    },
                    status: 'ACTIVE'
                },
                include: { employee: true }
            });

            for (const vehicle of vehiclesWithExpiringInsurance) {
                await this.createAlert({
                    employeeId: vehicle.employeeId || undefined,
                    type: 'VEHICLE_INSURANCE',
                    severity: 'HIGH',
                    title: 'Seguro por vencer',
                    message: `El seguro del vehículo ${vehicle.plate} vence el ${vehicle.insuranceExpiry?.toLocaleDateString()}.`,
                    actionUrl: `/assets?tab=vehicles`
                });
            }

            // 3. Maintenance Logic (Mileage based)
            // Prisma cannot compare currentMileage >= nextMaintenanceKm directly.
            const activeVehicles = await prisma.vehicle.findMany({
                where: {
                    status: 'ACTIVE',
                    nextMaintenanceKm: {
                        not: null
                    }
                },
                include: { employee: true }
            });

            const vehiclesNeedingMaintenance = activeVehicles.filter(v =>
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

    async getUnreadAlerts(permissions?: any) {
        // If it's a regular user (not admin), filter alerts they have permission for
        // (In this system, currently all alerts are for the "employees" module)
        const canSeeEmployeeAlerts = !permissions || permissions.employees !== 'none';

        if (!canSeeEmployeeAlerts) {
            return [];
        }

        return prisma.alert.findMany({
            where: {
                isRead: false,
                isDismissed: false
            },
            orderBy: {
                createdAt: 'desc'
            },
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

    async markAsRead(alertId: string) {
        return prisma.alert.update({
            where: { id: alertId },
            data: { isRead: true }
        });
    }

    async dismissAlert(alertId: string) {
        return prisma.alert.update({
            where: { id: alertId },
            data: { isDismissed: true }
        });
    }

    async markAllAsRead(permissions?: any) {
        // Same logic as getUnreadAlerts: filter by permission if needed
        // But for bulk update, we might just update all unread alerts visible to user?
        // Actually, we should only update alerts that the user *can see*.
        // If permissions are restricted, we need to respect that.
        // However, Prisma doesn't support complex filtering in updateMany easily with JSON fields permission check?
        // Wait, getUnreadAlerts logic was:
        // const canSeeEmployeeAlerts = !permissions || permissions.employees !== 'none';
        // If they can't see employee alerts, they see nothing (currently).

        const canSeeEmployeeAlerts = !permissions || permissions.employees !== 'none';
        if (!canSeeEmployeeAlerts) return { count: 0 };

        return prisma.alert.updateMany({
            where: {
                isRead: false,
                isDismissed: false
            },
            data: { isRead: true }
        });
    }

    async dismissAll(permissions?: any) {
        const canSeeEmployeeAlerts = !permissions || permissions.employees !== 'none';
        if (!canSeeEmployeeAlerts) return { count: 0 };

        return prisma.alert.updateMany({
            where: {
                isDismissed: false
            },
            data: { isDismissed: true }
        });
    }
}

export const alertService = new AlertService();
