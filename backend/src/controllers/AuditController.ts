import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuditService } from '../services/AuditService';

export const AuditController = {
    getLogs: async (req: Request, res: Response) => {
        const { entity, entityId } = req.params;
        try {
            if (!entity || !entityId) {
                return res.status(400).json({ error: 'Faltan parámetros de entidad' });
            }
            const logs = await prisma.auditLog.findMany({
                where: { entity: entity.toUpperCase(), entityId },
                orderBy: { createdAt: 'desc' },
                include: { user: true, targetEmployee: true }
            });
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
                include: { user: true, targetEmployee: true }
            });
            const mapped = logs.map((l: any) => ({
                ...l,
                details: `${l.action} ${l.entity} (${l.entityId})`
            }));
            res.json(mapped);
        } catch (error) {
            res.status(500).json({ error: 'Error fetching recent activity' });
        }
    },

    getAll: async (req: Request, res: Response) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const skip = (page - 1) * limit;

            const [logs, total] = await Promise.all([
                prisma.auditLog.findMany({
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                    include: { user: true, targetEmployee: true }
                }),
                prisma.auditLog.count()
            ]);

            const mappedLogs = logs.map(log => {
                let details = '';
                try {
                    const meta = log.metadata ? JSON.parse(log.metadata) : {};
                    if (log.action === 'CREATE') {
                        details = `Creado nuevo ${log.entity.toLowerCase()}: ${meta.name || log.entityId}`;
                    } else if (log.action === 'DELETE') {
                        details = `Eliminado ${log.entity.toLowerCase()}: ${meta.name || log.entityId}`;
                    } else if (log.action === 'UPDATE') {
                        const keys = Object.keys(meta).filter(k => k !== 'id' && k !== 'updatedAt');
                        details = `Actualizado ${log.entity.toLowerCase()}: ${keys.join(', ') || 'varios campos'}`;
                    } else {
                        details = meta.info || meta.message || log.action;
                    }

                    if (log.targetEmployee) {
                        const targetName = `${log.targetEmployee.firstName} ${log.targetEmployee.lastName || ''}`.trim();
                        details += ` (Afec. a ${targetName})`;
                    }
                } catch (e) {
                    details = log.action;
                }

                return {
                    ...log,
                    details
                };
            });

            res.json({
                success: true,
                data: mappedLogs,
                pagination: {
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: 'Error fetching global audit logs' });
        }
    }
};

