import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AuditService } from '../services/AuditService';
import { AuthenticatedRequest } from '../types/express';
import { AppError } from '../utils/AppError';
import { CacheService } from '../services/CacheService';
import { ObraAuthorization } from '../services/obraAuthorization';
import { Prisma } from '@prisma/client';

const FORBIDDEN_EXPENSE_UPDATE_KEYS = new Set([
    'id',
    'createdAt',
    'updatedAt',
    'createdById',
    'obraId',
    'importBatchId',
    'status'
]);

function ctx(req: Request) {
    return {
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
    };
}

export const ObraExpenseController = {
    listByObra: async (req: Request, res: Response) => {
        try {
            const { obraId } = req.params;
            await ObraAuthorization.ensureExists(obraId);
            const { type, status, employeeId, from, to } = req.query as Record<string, string | undefined>;

            const where: Prisma.ObraExpenseWhereInput = { obraId };
            if (type) where.type = type;
            if (status) where.status = status;
            if (employeeId) where.employeeId = employeeId;
            if (from || to) {
                where.date = {};
                if (from && !isNaN(Date.parse(from))) where.date.gte = new Date(from);
                if (to && !isNaN(Date.parse(to))) where.date.lte = new Date(to);
            }

            const expenses = await prisma.obraExpense.findMany({
                where,
                orderBy: { date: 'desc' },
                include: {
                    employee: { select: { id: true, name: true, firstName: true, lastName: true, dni: true } },
                    createdBy: { select: { id: true, email: true } }
                }
            });

            return ApiResponse.success(res, expenses);
        } catch (err: unknown) {
            if (err instanceof AppError) return ApiResponse.error(res, err.message, err.statusCode);
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al listar gastos', 500);
        }
    },

    create: async (req: Request, res: Response) => {
        try {
            const userId = (req as AuthenticatedRequest).user?.id;
            if (!userId) throw new AppError('Usuario no autenticado', 401);
            const { obraId } = req.params;
            const { type, date, amount, currency, description, vendor, reference, origin, destination, employeeId } = req.body || {};

            await ObraAuthorization.ensureActive(obraId);

            const expense = await prisma.obraExpense.create({
                data: {
                    obraId,
                    employeeId: employeeId || null,
                    type,
                    date: new Date(date),
                    amount,
                    currency: currency || 'EUR',
                    description: description ?? null,
                    vendor: vendor ?? null,
                    reference: reference ?? null,
                    origin: origin ?? null,
                    destination: destination ?? null,
                    status: 'APPROVED',
                    createdById: userId
                }
            });

            await AuditService.logWithContext('CREATE', 'OBRA_EXPENSE', expense.id, {
                userId,
                ...ctx(req),
                metadata: { obraId, type, amount: Number(expense.amount) }
            });

            CacheService.invalidateByPrefix('report:obra-summary:');
            CacheService.invalidateByPrefix('report:obra-employee:');

            return ApiResponse.success(res, expense, 'Gasto creado', 201);
        } catch (err: unknown) {
            if (err instanceof AppError) return ApiResponse.error(res, err.message, err.statusCode);
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al crear el gasto', 500);
        }
    },

    update: async (req: Request, res: Response) => {
        try {
            const userId = (req as AuthenticatedRequest).user?.id;
            if (!userId) throw new AppError('Usuario no autenticado', 401);
            const { id } = req.params;
            const data = req.body || {};

            const existing = await prisma.obraExpense.findUnique({ where: { id } });
            if (!existing) return ApiResponse.error(res, 'Gasto no encontrado', 404);

            // C4: Verify obra is active (consistent with create)
            await ObraAuthorization.ensureActive(existing.obraId);

            const updateData: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(data)) {
                if (FORBIDDEN_EXPENSE_UPDATE_KEYS.has(k)) continue;
                updateData[k] = v;
            }
            if ('date' in updateData) updateData.date = new Date(updateData.date as string);
            if ('amount' in updateData) updateData.amount = Math.round(Number(updateData.amount) * 100) / 100;
            if ('employeeId' in updateData) updateData.employeeId = updateData.employeeId || null;

            const updated = await prisma.obraExpense.update({ where: { id }, data: updateData as Prisma.ObraExpenseUpdateInput });
            await AuditService.logWithContext('UPDATE', 'OBRA_EXPENSE', id, {
                userId,
                ...ctx(req),
                metadata: { fields: Object.keys(updateData), before: { type: existing.type, amount: Number(existing.amount), date: existing.date } }
            });

            CacheService.invalidateByPrefix('report:obra-summary:');
            CacheService.invalidateByPrefix('report:obra-employee:');
            return ApiResponse.success(res, updated, 'Gasto actualizado');
        } catch (err: unknown) {
            if (err instanceof AppError) return ApiResponse.error(res, err.message, err.statusCode);
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al actualizar el gasto', 500);
        }
    },

    delete: async (req: Request, res: Response) => {
        try {
            const userId = (req as AuthenticatedRequest).user?.id;
            if (!userId) throw new AppError('Usuario no autenticado', 401);
            const { id } = req.params;
            const existing = await prisma.obraExpense.findUnique({ where: { id } });
            if (!existing) return ApiResponse.error(res, 'Gasto no encontrado', 404);

            // C4: Verify obra is active (consistent with create)
            await ObraAuthorization.ensureActive(existing.obraId);

            await prisma.obraExpense.delete({ where: { id } });
            await AuditService.logWithContext('DELETE', 'OBRA_EXPENSE', id, {
                userId,
                ...ctx(req),
                metadata: { snapshot: { type: existing.type, amount: Number(existing.amount), date: existing.date, obraId: existing.obraId } }
            });

            CacheService.invalidateByPrefix('report:obra-summary:');
            CacheService.invalidateByPrefix('report:obra-employee:');
            return ApiResponse.success(res, null, 'Gasto eliminado');
        } catch (err: unknown) {
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al eliminar el gasto', 500);
        }
    },

    listAll: async (req: Request, res: Response) => {
        try {
            const { type, obraId, from, to, limit } = req.query as Record<string, string | undefined>;
            const where: Prisma.ObraExpenseWhereInput = {};
            if (type) where.type = type;
            if (obraId) where.obraId = obraId;
            if (from || to) {
                where.date = {};
                if (from && !isNaN(Date.parse(from))) where.date.gte = new Date(from);
                if (to && !isNaN(Date.parse(to))) where.date.lte = new Date(to);
            }
            const cap = Math.min(500, Math.max(1, Number(limit) || 100));
            const expenses = await prisma.obraExpense.findMany({
                where,
                orderBy: { date: 'desc' },
                include: {
                    obra: { select: { id: true, code: true, name: true } },
                    employee: { select: { id: true, name: true, firstName: true, lastName: true, dni: true } }
                },
                take: cap
            });
            return ApiResponse.success(res, expenses);
        } catch (err: unknown) {
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al listar gastos', 500);
        }
    }
};
