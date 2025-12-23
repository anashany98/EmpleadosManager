import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../services/AuditService';

const prisma = new PrismaClient();

export const AuditController = {
    getLogs: async (req: Request, res: Response) => {
        const { entity, entityId } = req.params;
        try {
            const logs = await AuditService.getLogs(entity.toUpperCase(), entityId);
            res.json(logs);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener registros de auditoría' });
        }
    },

    getRecentActivity: async (req: Request, res: Response) => {
        try {
            const logs = await prisma.auditLog.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: { user: true }
            });
            const mapped = logs.map((l: any) => ({
                ...l,
                details: `${l.action} ${l.entity} (${l.entityId})`
            }));
            res.json(mapped);
        } catch (error) {
            res.status(500).json({ error: 'Error fetching recent activity' });
        }
    }
};

