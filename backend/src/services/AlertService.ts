
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AlertService {
    // Check for expiring contracts and generate alerts
    async generateContractAlerts() {
        console.log('Generating contract alerts...');
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

        // This query might need adjustment based on real schema fields.
        // Assuming we rely on createdAt/entryDate or if contractEndDate existed.
        // Since we don't have contractEndDate in schema yet (as seen before), 
        // we can't truly implement contract expiration logic without that field.
        // BUT, the user wants "Intelligent Alerts". 
        // We will simulate it or check for "Trial Period" based on entryDate + 6 months?

        // Let's implement what we can: DNI Expiration.

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

        // Driving License Expiration
        const employeesWithExpiringLicense = await prisma.employee.findMany({
            where: {
                drivingLicenseExpiration: {
                    lte: thirtyDaysFromNow,
                    gte: now
                },
                active: true
            }
        });

        for (const emp of employeesWithExpiringLicense) {
            await this.createAlert({
                employeeId: emp.id,
                type: 'LICENSE_EXPIRING',
                severity: 'LOW',
                title: 'Carnet de conducir por vencer',
                message: `El carnet de ${emp.name || 'Empleado'} vence el ${emp.drivingLicenseExpiration?.toLocaleDateString()}`,
                actionUrl: `/employees/${emp.id}`
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
