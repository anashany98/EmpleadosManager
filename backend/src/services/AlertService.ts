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
        log.info('Generating stock alerts...');
        const lowStockItems = await prisma.inventoryItem.findMany({
            where: {
                quantity: {
                    lte: prisma.inventoryItem.fields.minQuantity
                }
            }
        });

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
    }

    async runAllChecks() {
        await this.generateContractAlerts();
        await this.generateStockAlerts();
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
}

export const alertService = new AlertService();
