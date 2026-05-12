import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types/express';
import { AppError } from '../utils/AppError';
import { resolveAuthorizedCompanyId } from '../utils/companyAccess';

const SYSTEM_AUDIT_ACTIONS = [
    'LOGIN',
    'LOGIN_FAILED',
    'LOGIN_ATTEMPT',
    'LOGIN_SUCCESS',
    'LOGOUT',
    'PASSWORD_CHANGE',
    'PASSWORD_RESET',
    'PERMISSION_CHANGE',
    'ACCESS_DENIED',
    'ACCESS_GENERATED',
    'SECURITY_VIOLATION',
    'VIEW',
    'ACCESS',
    'READ',
    'DATA_EXPORT'
];

const EMPLOYEE_RECORD_ACTIONS = [
    'CREATE',
    'UPDATE',
    'DELETE',
    'IMPORT',
    'PRIVATE_NOTE_UPDATE',
    'VACATION_BALANCE_UPDATE',
    'DATA_CREATE',
    'DATA_UPDATE',
    'DATA_DELETE'
];

export const AuditController = {
    getLogs: async (req: Request, res: Response) => {
        const { entity, entityId } = req.params;
        try {
            if (!entity || !entityId) {
                return res.status(400).json({ error: 'Faltan parámetros de entidad' });
            }

            const showAccess = req.query.showAccess === 'true';
            const normalizedEntity = entity.toUpperCase();
            const where: any = { entity: normalizedEntity, entityId };

            if (!showAccess && normalizedEntity === 'EMPLOYEE') {
                where.action = { in: EMPLOYEE_RECORD_ACTIONS };
            }

            const logs = await prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: { user: true, targetEmployee: true }
            });
            res.json(logs);
        } catch (error) {
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({ error: error.message });
            }

            res.status(500).json({ error: 'Error al obtener registros de auditoría' });
        }
    },

    getRecentActivity: async (req: Request, res: Response) => {
        try {
            const user = (req as AuthenticatedRequest).user;
            const companyId = resolveAuthorizedCompanyId(user, req.query.companyId as string | undefined);
            const where: any = {
                action: {
                    notIn: SYSTEM_AUDIT_ACTIONS
                }
            };

            if (companyId) {
                where.OR = [
                    { targetEmployee: { companyId } },
                    { user: { employee: { companyId } } }
                ];
            }

            const logs = await prisma.auditLog.findMany({
                where,
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
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({ error: error.message });
            }

            res.status(500).json({ error: 'Error fetching recent activity' });
        }
    },

    getAll: async (req: Request, res: Response) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const skip = (page - 1) * limit;
            const showSystem = req.query.showSystem === 'true';

            const where: any = {};
            if (!showSystem) {
                where.action = {
                    notIn: SYSTEM_AUDIT_ACTIONS
                };
                where.entity = {
                    notIn: ['USER']
                };
            }

            const [logs, total] = await Promise.all([
                prisma.auditLog.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                    include: { user: true, targetEmployee: true }
                }),
                prisma.auditLog.count({ where })
            ]);

            const mappedLogs = logs.map(log => {
                let details: string;
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
                        const firstName = log.targetEmployee.firstName || '';
                        const lastName = log.targetEmployee.lastName || '';
                        const targetName = `${firstName} ${lastName}`.trim();
                        details += ` (Afec. a ${targetName})`;
                    }
                } catch {
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
        } catch {
            res.status(500).json({ success: false, error: 'Error fetching global audit logs' });
        }
    }
};
