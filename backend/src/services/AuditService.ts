import { prisma } from '../lib/prisma';

export class AuditService {
    static async log(action: string, entity: string, entityId: string, metadata?: any, userId?: string) {
        try {
            await prisma.auditLog.create({
                data: {
                    action,
                    entity,
                    entityId,
                    metadata: metadata ? JSON.stringify(metadata) : null,
                    userId
                }
            });
        } catch (error) {
            console.error('Error logging audit:', error);
        }
    }

    static async getLogs(entity: string, entityId: string) {
        return await prisma.auditLog.findMany({
            where: { entity, entityId },
            orderBy: { createdAt: 'desc' },
            include: { user: true }
        });
    }
}
