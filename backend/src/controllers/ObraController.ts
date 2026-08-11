import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AuditService } from '../services/AuditService';
import { NotificationService } from '../services/NotificationService';
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
            // Paginación: expenses y employeeWork se paginan para evitar respuestas
            // gigantes en obras con muchos meses de actividad. Defaults razonables.
            const expensesPage = Math.max(1, Number(req.query.expensesPage) || 1);
            const expensesLimit = Math.min(200, Math.max(1, Number(req.query.expensesLimit) || 50));
            const expensesSkip = (expensesPage - 1) * expensesLimit;
            const workPage = Math.max(1, Number(req.query.workPage) || 1);
            const workLimit = Math.min(200, Math.max(1, Number(req.query.workLimit) || 50));
            const workSkip = (workPage - 1) * workLimit;

            // Filtros opcionales (compatibles con la query del endpoint
            // `ObraExpenseController.listByObra` para tener UX consistente)
            const expenseType = req.query.expenseType ? String(req.query.expenseType) : null;
            const employeeId = req.query.employeeId ? String(req.query.employeeId) : null;
            const from = req.query.from && !isNaN(Date.parse(String(req.query.from))) ? new Date(String(req.query.from)) : null;
            const to = req.query.to && !isNaN(Date.parse(String(req.query.to))) ? new Date(String(req.query.to)) : null;

            const obra = await prisma.project.findUnique({
                where: { id },
                include: {
                    manager: { select: { id: true, name: true, firstName: true, lastName: true } }
                }
            });
            if (!obra) return ApiResponse.error(res, 'Obra no encontrada', 404);

            // Construir where clauses con filtros
            const expenseWhere: any = { obraId: id };
            if (expenseType) expenseWhere.type = expenseType;
            if (employeeId) expenseWhere.employeeId = employeeId;
            if (from || to) {
                expenseWhere.date = {};
                if (from) expenseWhere.date.gte = from;
                if (to) expenseWhere.date.lte = to;
            }
            const workWhere: any = { projectId: id };
            if (employeeId) workWhere.employeeId = employeeId;
            if (from || to) {
                workWhere.AND = [
                    ...(from ? [{ endDate: { gte: from } }] : []),
                    ...(to ? [{ startDate: { lte: to } }] : [])
                ];
            }

            // Carga en paralelo: listas paginadas + counts + totales
            const [
                expenses,
                expensesTotal,
                employeeWork,
                employeeWorkTotal,
                totalsByType,
                hoursAgg
            ] = await Promise.all([
                prisma.obraExpense.findMany({
                    where: expenseWhere,
                    orderBy: { date: 'desc' },
                    include: {
                        employee: { select: { id: true, name: true, firstName: true, lastName: true, dni: true } },
                        contractor: { select: { id: true, name: true, nif: true } }
                    },
                    skip: expensesSkip,
                    take: expensesLimit
                }),
                prisma.obraExpense.count({ where: expenseWhere }),
                prisma.employeeProjectWork.findMany({
                    where: workWhere,
                    orderBy: { startDate: 'desc' },
                    include: { employee: { select: { id: true, name: true, firstName: true, lastName: true, dni: true } } },
                    skip: workSkip,
                    take: workLimit
                }),
                prisma.employeeProjectWork.count({ where: workWhere }),
                prisma.obraExpense.groupBy({
                    by: ['type'],
                    where: { obraId: id }, // totales SIEMPRE sin filtrar — son la foto global
                    _sum: { amount: true }
                }),
                prisma.employeeProjectWork.aggregate({
                    where: { projectId: id },
                    _sum: { hours: true }
                })
            ]);

            const totalHours = Number(hoursAgg._sum.hours || 0);

            const totalsByTypeMap: Record<string, number> = {};
            for (const t of totalsByType) totalsByTypeMap[t.type] = Number(t._sum.amount || 0);

            const totals: ObraTotals = {
                hours: totalHours,
                byType: totalsByTypeMap,
                totalExpenses: Object.values(totalsByTypeMap).reduce((a, b) => a + b, 0)
            };

            return ApiResponse.success(res, {
                ...obra,
                totals,
                expenses,
                expensesMeta: {
                    page: expensesPage,
                    limit: expensesLimit,
                    total: expensesTotal,
                    totalPages: Math.ceil(expensesTotal / expensesLimit)
                },
                employeeWork,
                employeeWorkMeta: {
                    page: workPage,
                    limit: workLimit,
                    total: employeeWorkTotal,
                    totalPages: Math.ceil(employeeWorkTotal / workLimit)
                }
            });
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

            const obra = await prisma.project.findUnique({
                where: { id },
                select: { id: true, endDate: true, startDate: true, managerId: true, code: true, name: true }
            });
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

            // Detectar cambio de manager para notificar al nuevo (no al viejo, que
            // ya sabe que la obra no es suya). Solo si el nuevo tiene un User
            // vinculado, si no, no hay a quién notificar.
            const managerChanged = 'managerId' in updateData
                && updateData.managerId !== obra.managerId
                && Boolean(updateData.managerId);

            const updated = await prisma.project.update({ where: { id }, data: updateData as Prisma.ProjectUpdateInput });

            if (managerChanged && updateData.managerId) {
                const newManagerUser = await prisma.user.findFirst({
                    where: { employeeId: updateData.managerId as string },
                    select: { id: true }
                });
                if (newManagerUser) {
                    await NotificationService.create({
                        userId: newManagerUser.id,
                        title: `Asignado como manager de ${obra.code}`,
                        message: `Se te ha asignado como manager de la obra "${obra.name}". Ahora puedes ver y gestionar sus gastos y horas.`,
                        type: 'INFO',
                        link: `/obras/${id}`
                    });
                }
            }

            await AuditService.logWithContext('UPDATE', 'OBRA', id, {
                userId,
                ...ctx(req),
                metadata: {
                    fields: Object.keys(updateData),
                    managerChanged
                }
            });

            invalidateObraReports();

            return ApiResponse.success(res, updated, 'Obra actualizada');
        } catch (err: unknown) {
            if (err !== null && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2003') return ApiResponse.error(res, 'managerId no existe', 400);
            if (err instanceof AppError) return ApiResponse.error(res, err.message, err.statusCode);
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al actualizar la obra', 500);
        }
    },

    /**
     * Devuelve el impacto de cerrar la obra: cuántos gastos y horas se verán
     * afectados, cuántos empleados únicos están asignados, y un desglose por
     * tipo de gasto. El frontend lo usa para mostrar al usuario lo que va a
     * bloquear antes de pedir confirmación.
     *
     * Cierra significa: status -> INACTIVE. Los gastos y horas YA creados se
     * conservan (no se borran); lo que se bloquea es la creación de nuevos
     * (la autorización `ensureActive` lo impide).
     */
    getCloseImpact: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const obra = await prisma.project.findUnique({
                where: { id },
                select: { id: true, status: true, code: true, name: true }
            });
            if (!obra) return ApiResponse.error(res, 'Obra no encontrada', 404);
            if (obra.status === 'INACTIVE') return ApiResponse.error(res, 'La obra ya está cerrada', 409);

            const [expensesCount, workEntriesCount, uniqueEmployees, totalsByType, recentWork] = await Promise.all([
                prisma.obraExpense.count({ where: { obraId: id } }),
                prisma.employeeProjectWork.count({ where: { projectId: id } }),
                prisma.employeeProjectWork.findMany({
                    where: { projectId: id },
                    select: { employeeId: true },
                    distinct: ['employeeId']
                }),
                prisma.obraExpense.groupBy({
                    by: ['type'],
                    where: { obraId: id },
                    _count: { _all: true },
                    _sum: { amount: true }
                }),
                // Detectar tramos de horas "abiertos" (sin endDate). Como endDate
                // es NOT NULL en el schema, los que aún están activos son los
                // que tienen endDate = startDate (placeholder) o un endDate
                // muy futuro. Filtramos por startDate dentro de los últimos 30
                // días sin endDate "natural" — heurística simple pero suficiente
                // para advertir al usuario de que cierre la obra.
                prisma.employeeProjectWork.findMany({
                    where: {
                        projectId: id,
                        startDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                    },
                    include: { employee: { select: { name: true, firstName: true, lastName: true } } }
                })
            ]);

            const totalAmount = totalsByType.reduce((acc, t) => acc + Number(t._sum.amount || 0), 0);
            const breakdown = totalsByType.map((t) => ({
                type: t.type,
                count: t._count._all,
                amount: Number(t._sum.amount || 0)
            }));

            return ApiResponse.success(res, {
                obra: { id: obra.id, code: obra.code, name: obra.name },
                impact: {
                    expensesCount,
                    workEntriesCount,
                    uniqueEmployeesCount: uniqueEmployees.length,
                    totalAmount: Math.round(totalAmount * 100) / 100,
                    breakdown,
                    openWorkEntries: recentWork.length,
                    openWorkEntriesDetail: recentWork.map((w) => ({
                        id: w.id,
                        employee: w.employee?.name || `${w.employee?.firstName || ''} ${w.employee?.lastName || ''}`.trim(),
                        startDate: w.startDate
                    }))
                },
                warning: recentWork.length > 0
                    ? `Hay ${recentWork.length} tramo(s) de horas sin cerrar. Tras cerrar la obra no podrás editarlos.`
                    : null
            });
        } catch (err: unknown) {
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al calcular el impacto', 500);
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
