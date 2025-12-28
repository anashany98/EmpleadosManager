
import { prisma } from '../lib/prisma';



export class AlertService {
    // Check for expiring contracts and generate alerts
    async generateContractAlerts() {
        console.log('Generating multi-category alerts (Document Semaphore)...');
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

    async createAlert(data: {
        employeeId?: string;
        type: string;
        severity: string;
        title: string;
        message: string;
        actionUrl?: string;
    }) {
        // Avoid duplicate alerts (same type/employee in last 24h)
        const existing = await prisma.alert.findFirst({
            where: {
                employeeId: data.employeeId,
                type: data.type,
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                },
                isDismissed: false
            }
        });

        if (!existing) {
            await prisma.alert.create({
                data: {
                    ...data,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expires in 7 days
                }
            });
            console.log(`Alert created: ${data.title}`);
        }
    }

    async getUnreadAlerts() {
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
