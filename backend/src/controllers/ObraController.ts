import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AuditService } from '../services/AuditService';
import { AuthenticatedRequest } from '../types/express';
import { AppError } from '../utils/AppError';
import { CacheService } from '../services/CacheService';
import { OBRA_STATUS, type ObraStatus } from '../../../shared/obras';
import { Prisma } from '@prisma/client';

function invalidateObraReports() {
    CacheService.invalidateByPrefix('report:obra-summary:');
    CacheService.invalidateByPrefix('report:obra-employee:');
}

function ctx(req: Request) {
    return {
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
    };
}

const FORBIDDEN_UPDATE_KEYS = new Set([
    'id',
    'createdAt',
    'updatedAt',
    'createdById',
    'obraId',
    'importBatchId',
    'code',
    'status'
]);

export interface ObraTotals {
    hours: number;
    byType: Record<string, number>;
    totalExpenses: number;
}

export const ObraController = {
    list: async (req: Request, res: Response) => {
        try {
            const status = req.query.status ? String(req.query.status) : undefined;
            const q = req.query.q ? String(req.query.q).trim() : '';
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
            const skip = (page - 1) * limit;

            const where: Prisma.ProjectWhereInput = {};
            if (status === 'ACTIVE' || status === 'INACTIVE') {
                where.status = status;
            } else {
                where.status = 'ACTIVE';
            }
            if (q) {
                where.OR = [
                    { code: { contains: q, mode: 'insensitive' } },
                    { name: { contains: q, mode: 'insensitive' } },
                    { clientName: { contains: q, mode: 'insensitive' } }
                ];
            }

            const [obras, total] = await Promise.all([
                prisma.project.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                    include: {
                        manager: { select: { id: true, name: true, firstName: true, lastName: true } },
                        _count: { select: { employeeWork: true, expenses: true } }
                    }
                }),
                prisma.project.count({ where })
            ]);

            const totalsByObra = obras.length
                ? await prisma.obraExpense.groupBy({
                    by: ['obraId', 'type'],
                    where: { obraId: { in: obras.map((o) => o.id) } },
                    _sum: { amount: true }
                })
                : [];
            const totalsMap = new Map<string, Record<string, number>>();
            for (const row of totalsByObra) {
                if (!totalsMap.has(row.obraId)) totalsMap.set(row.obraId, {});
                totalsMap.get(row.obraId)![row.type] = Number(row._sum.amount || 0);
            }

            const result = obras.map((o) => ({
                ...o,
                totals: totalsMap.get(o.id) || {}
            }));

            return ApiResponse.paginated(res, result, {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            });
        } catch (err: unknown) {
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al listar obras', 500);
        }
    },

    getById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const obra = await prisma.project.findUnique({
                where: { id },
                include: {
                    manager: { select: { id: true, name: true, firstName: true, lastName: true } },
                    expenses: {
                        where: { obraId: id },
                        orderBy: { date: 'desc' },
                        include: { employee: { select: { id: true, name: true, firstName: true, lastName: true, dni: true } } }
                    },
                    employeeWork: {
                        where: { projectId: id },
                        orderBy: { startDate: 'desc' },
                        include: { employee: { select: { id: true, name: true, firstName: true, lastName: true, dni: true } } }
                    }
                }
            });
            if (!obra) return ApiResponse.error(res, 'Obra no encontrada', 404);

            const totalsByType = await prisma.obraExpense.groupBy({
                by: ['type'],
                where: { obraId: id },
                _sum: { amount: true }
            });
            const totalHours = obra.employeeWork.reduce((acc, w) => acc + Number(w.hours || 0), 0);

            const totalsByTypeMap: Record<string, number> = {};
            for (const t of totalsByType) totalsByTypeMap[t.type] = Number(t._sum.amount || 0);

            const totals: ObraTotals = {
                hours: totalHours,
                byType: totalsByTypeMap,
                totalExpenses: Object.values(totalsByTypeMap).reduce((a, b) => a + b, 0)
            };

            return ApiResponse.success(res, { ...obra, totals });
        } catch (err: unknown) {
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al obtener la obra', 500);
        }
    },

    create: async (req: Request, res: Response) => {
        try {
            const userId = (req as AuthenticatedRequest).user?.id;
            if (!userId) throw new AppError('Usuario no autenticado', 401);
            const { code, name, destination, description, clientName, startDate, endDate, budget, managerId } = req.body || {};

            if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
                throw new AppError('endDate debe ser posterior o igual a startDate', 400);
            }
            if (managerId) {
                const mgr = await prisma.employee.findUnique({ where: { id: managerId }, select: { id: true } });
                if (!mgr) throw new AppError('managerId no existe', 400);
            }

            let obra;
            try {
                obra = await prisma.project.create({
                    data: {
                        code,
                        name,
                        destination: destination ?? null,
                        description: description ?? null,
                        clientName: clientName ?? null,
                        startDate: startDate ? new Date(startDate) : null,
                        endDate: endDate ? new Date(endDate) : null,
                        budget: budget != null && budget !== '' ? Number(budget) : null,
                        managerId: managerId || null,
                        status: 'ACTIVE'
                    }
                });
            } catch (e: unknown) {
                if (e !== null && typeof e === 'object' && 'code' in e) {
                    const code = (e as { code: string }).code;
                    if (code === 'P2002') {
                        throw new AppError('Ya existe una obra con ese código', 409);
                    }
                    if (code === 'P2003') {
                        throw new AppError('managerId no existe', 400);
                    }
                }
                throw e;
            }

            await AuditService.logWithContext('CREATE', 'OBRA', obra.id, {
                userId,
                ...ctx(req),
                metadata: { code: obra.code, name: obra.name }
            });

            invalidateObraReports();

            return ApiResponse.success(res, obra, 'Obra creada', 201);
        } catch (err: unknown) {
            if (err instanceof AppError) return ApiResponse.error(res, err.message, err.statusCode);
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al crear la obra', 500);
        }
    },

    update: async (req: Request, res: Response) => {
        try {
            const userId = (req as AuthenticatedRequest).user?.id;
            if (!userId) throw new AppError('Usuario no autenticado', 401);
            const { id } = req.params;
            const data = req.body || {};

            const obra = await prisma.project.findUnique({ where: { id }, select: { id: true, endDate: true, startDate: true } });
            if (!obra) return ApiResponse.error(res, 'Obra no encontrada', 404);

            const updateData: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(data)) {
                if (FORBIDDEN_UPDATE_KEYS.has(k)) continue;
                updateData[k] = v;
            }

            if ('startDate' in updateData || 'endDate' in updateData) {
                const newStart = updateData.startDate ? new Date(updateData.startDate as string) : obra.startDate;
                const newEnd = updateData.endDate ? new Date(updateData.endDate as string) : obra.endDate;
                if (newStart && newEnd && newStart > newEnd) {
                    throw new AppError('endDate debe ser posterior o igual a startDate', 400);
                }
                if (updateData.startDate !== undefined) updateData.startDate = updateData.startDate ? new Date(updateData.startDate as string) : null;
                if (updateData.endDate !== undefined) updateData.endDate = updateData.endDate ? new Date(updateData.endDate as string) : null;
            }

            if (updateData.budget !== undefined) {
                updateData.budget = updateData.budget != null && updateData.budget !== '' ? Number(updateData.budget) : null;
            }
            if (updateData.managerId !== undefined) {
                if (updateData.managerId) {
                    const mgr = await prisma.employee.findUnique({ where: { id: updateData.managerId as string }, select: { id: true } });
                    if (!mgr) throw new AppError('managerId no existe', 400);
                }
                updateData.managerId = updateData.managerId || null;
            }

            const updated = await prisma.project.update({ where: { id }, data: updateData as Prisma.ProjectUpdateInput });

            await AuditService.logWithContext('UPDATE', 'OBRA', id, {
                userId,
                ...ctx(req),
                metadata: { fields: Object.keys(updateData) }
            });

            invalidateObraReports();

            return ApiResponse.success(res, updated, 'Obra actualizada');
        } catch (err: unknown) {
            if (err !== null && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2003') return ApiResponse.error(res, 'managerId no existe', 400);
            if (err instanceof AppError) return ApiResponse.error(res, err.message, err.statusCode);
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al actualizar la obra', 500);
        }
    },

    close: async (req: Request, res: Response) => {
        try {
            const userId = (req as AuthenticatedRequest).user?.id;
            if (!userId) throw new AppError('Usuario no autenticado', 401);
            const { id } = req.params;

            const obra = await prisma.project.findUnique({ where: { id } });
            if (!obra) return ApiResponse.error(res, 'Obra no encontrada', 404);
            if (obra.status === 'INACTIVE') return ApiResponse.error(res, 'La obra ya está cerrada', 409);

            const updated = await prisma.project.update({
                where: { id },
                data: { status: 'INACTIVE', active: false }
            });
            await AuditService.logWithContext('CLOSE', 'OBRA', id, { userId, ...ctx(req) });
            invalidateObraReports();
            return ApiResponse.success(res, updated, 'Obra cerrada');
        } catch (err: unknown) {
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al cerrar la obra', 500);
        }
    },

    reopen: async (req: Request, res: Response) => {
        try {
            const userId = (req as AuthenticatedRequest).user?.id;
            if (!userId) throw new AppError('Usuario no autenticado', 401);
            const { id } = req.params;

            const obra = await prisma.project.findUnique({ where: { id } });
            if (!obra) return ApiResponse.error(res, 'Obra no encontrada', 404);
            if (obra.status === 'ACTIVE') return ApiResponse.error(res, 'La obra ya está activa', 409);

            const updated = await prisma.project.update({
                where: { id },
                data: { status: 'ACTIVE', active: true }
            });
            await AuditService.logWithContext('REOPEN', 'OBRA', id, { userId, ...ctx(req) });
            invalidateObraReports();
            return ApiResponse.success(res, updated, 'Obra reactivada');
        } catch (err: unknown) {
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al reabrir la obra', 500);
        }
    },

    OBRA_STATUS: OBRA_STATUS as readonly ObraStatus[]
};
