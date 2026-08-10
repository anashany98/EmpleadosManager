import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AuditService } from '../services/AuditService';
import { AuthenticatedRequest } from '../types/express';
import { AppError } from '../utils/AppError';
import { CacheService } from '../services/CacheService';
import { ObraAuthorization } from '../services/obraAuthorization';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ObraExpenseReceiptService } from '../services/ObraExpenseReceiptService';
import { countInclusiveDays, splitAmountEvenly } from '../services/expenseAllocation';

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
                    contractor: { select: { id: true, name: true, nif: true } },
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
            const {
                type, date, endDate, amount, amountMode, currency, description, vendor,
                reference, origin, destination, employeeId, employeeIds, contractorId
            } = req.body || {};

            await ObraAuthorization.ensureActive(obraId);

            const selectedEmployeeIds = Array.from(new Set(
                Array.isArray(employeeIds) && employeeIds.length > 0
                    ? employeeIds
                    : employeeId ? [employeeId] : []
            )) as string[];
            if (selectedEmployeeIds.length > 0) {
                const employeeCount = await prisma.employee.count({
                    where: { id: { in: selectedEmployeeIds } }
                });
                if (employeeCount !== selectedEmployeeIds.length) {
                    throw new AppError('Uno o varios empleados seleccionados no existen', 400);
                }
            }

            if (contractorId) {
                const contractor = await prisma.obraContractor.findUnique({ where: { id: contractorId } });
                if (!contractor) {
                    throw new AppError('El autónomo seleccionado no existe', 400);
                }
            }

            const allocationCount = Math.max(1, selectedEmployeeIds.length);
            const enteredAmount = Math.round(Number(amount) * 100) / 100;
            const dailyMode = type === 'PER_DIEM' && amountMode === 'PER_EMPLOYEE_DAY';
            const unitCount = dailyMode ? countInclusiveDays(date, endDate || date) : 1;
            const amountPerEmployee = dailyMode
                ? Math.round(enteredAmount * unitCount * 100) / 100
                : null;
            const allocatedAmounts = dailyMode
                ? Array.from({ length: allocationCount }, () => amountPerEmployee as number)
                : splitAmountEvenly(enteredAmount, allocationCount);
            const originalAmount = dailyMode
                ? Math.round((amountPerEmployee as number) * allocationCount * 100) / 100
                : enteredAmount;
            const allocationGroupId = allocationCount > 1 ? randomUUID() : null;
            const sourceReference = reference ?? null;
            const targets: Array<string | null> = selectedEmployeeIds.length > 0 ? selectedEmployeeIds : [null];

            const expenses = await prisma.$transaction(targets.map((targetEmployeeId, index) =>
                prisma.obraExpense.create({
                    data: {
                        obraId,
                        employeeId: targetEmployeeId,
                        contractorId: contractorId || null,
                        type,
                        date: new Date(date),
                        endDate: new Date(endDate || date),
                        amount: allocatedAmounts[index],
                        originalAmount,
                        unitAmount: dailyMode ? enteredAmount : null,
                        unitCount,
                        allocationGroupId,
                        allocationIndex: allocationGroupId ? index + 1 : null,
                        allocationCount,
                        currency: currency || 'EUR',
                        description: description ?? null,
                        vendor: vendor ?? null,
                        // Preserve the user-facing reference separately while retaining
                        // the existing import idempotency constraint.
                        reference: allocationGroupId && sourceReference
                            ? `${sourceReference} [${allocationGroupId.slice(0, 8)}:${index + 1}]`
                            : sourceReference,
                        sourceReference,
                        origin: origin ?? null,
                        destination: destination ?? null,
                        status: 'APPROVED',
                        createdById: userId
                    }
                })
            ));

            await AuditService.logWithContext('CREATE', 'OBRA_EXPENSE_ALLOCATION', allocationGroupId || expenses[0].id, {
                userId,
                ...ctx(req),
                metadata: {
                    obraId,
                    type,
                    originalAmount,
                    unitAmount: dailyMode ? enteredAmount : null,
                    unitCount,
                    allocationCount,
                    employeeIds: selectedEmployeeIds,
                    contractorId: contractorId || null,
                    expenseIds: expenses.map((expense) => expense.id)
                }
            });

            CacheService.invalidateByPrefix('report:obra-summary:');
            CacheService.invalidateByPrefix('report:obra-employee:');

            return ApiResponse.success(res, {
                expenses,
                allocationGroupId,
                originalAmount,
                allocationCount
            }, allocationCount > 1 ? `Gasto repartido entre ${allocationCount} empleados` : 'Gasto creado', 201);
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
            const amountMode = updateData.amountMode;
            delete updateData.amountMode;
            if ('date' in updateData) updateData.date = new Date(updateData.date as string);
            if ('endDate' in updateData && updateData.endDate) updateData.endDate = new Date(updateData.endDate as string);
            if ('amount' in updateData) updateData.amount = Math.round(Number(updateData.amount) * 100) / 100;
            if ('employeeId' in updateData) updateData.employeeId = updateData.employeeId || null;
            if ('contractorId' in updateData) {
                updateData.contractorId = updateData.contractorId || null;
                if (updateData.contractorId) {
                    const contractor = await prisma.obraContractor.findUnique({ where: { id: updateData.contractorId as string } });
                    if (!contractor) throw new AppError('El autónomo seleccionado no existe', 400);
                }
            }

            const effectiveType = String(updateData.type || existing.type);
            if (effectiveType === 'PER_DIEM' && amountMode === 'PER_EMPLOYEE_DAY') {
                const start = (updateData.date as Date | undefined) || existing.date;
                const end = (updateData.endDate as Date | undefined) || existing.endDate || start;
                const dailyAmount = Number(updateData.amount ?? existing.unitAmount ?? existing.amount);
                const days = countInclusiveDays(start, end);
                updateData.unitAmount = dailyAmount;
                updateData.unitCount = days;
                updateData.amount = Math.round(dailyAmount * days * 100) / 100;
                updateData.originalAmount = updateData.amount;
            }

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

            // ?allGroup=true borra todas las partes de un gasto repartido
            // (mismo allocationGroupId) en una sola transacción, para que
            // borrar desde la vista de un empleado no deje las partes de
            // los demás como "huérfanas" de un grupo incompleto.
            const allGroup = String(req.query.allGroup || '').toLowerCase() === 'true';
            const hasGroup = Boolean(existing.allocationGroupId) && (existing.allocationCount || 1) > 1;

            if (allGroup && hasGroup) {
                const groupId = existing.allocationGroupId as string;
                const groupSnapshot = await prisma.obraExpense.findMany({
                    where: { allocationGroupId: groupId },
                    select: { id: true, type: true, amount: true, date: true, obraId: true, employeeId: true }
                });
                await prisma.$transaction([
                    prisma.obraExpense.deleteMany({ where: { allocationGroupId: groupId } })
                ]);
                await AuditService.logWithContext('DELETE', 'OBRA_EXPENSE_ALLOCATION', groupId, {
                    userId,
                    ...ctx(req),
                    metadata: {
                        scope: 'allGroup',
                        obraId: existing.obraId,
                        allocationCount: groupSnapshot.length,
                        expenseIds: groupSnapshot.map((e) => e.id),
                        snapshot: groupSnapshot.map((e) => ({ type: e.type, amount: Number(e.amount), date: e.date, employeeId: e.employeeId }))
                    }
                });
            } else {
                await prisma.obraExpense.delete({ where: { id } });
                await AuditService.logWithContext('DELETE', 'OBRA_EXPENSE', id, {
                    userId,
                    ...ctx(req),
                    metadata: { snapshot: { type: existing.type, amount: Number(existing.amount), date: existing.date, obraId: existing.obraId, employeeId: existing.employeeId } }
                });
            }

            CacheService.invalidateByPrefix('report:obra-summary:');
            CacheService.invalidateByPrefix('report:obra-employee:');
            return ApiResponse.success(
                res,
                null,
                allGroup && hasGroup ? 'Gasto repartido eliminado por completo' : 'Gasto eliminado'
            );
        } catch (err: unknown) {
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al eliminar el gasto', 500);
        }
    },

    listAll: async (req: Request, res: Response) => {
        try {
            const { type, obraId, employeeId, from, to, limit } = req.query as Record<string, string | undefined>;
            const where: Prisma.ObraExpenseWhereInput = {};
            if (type) where.type = type;
            if (obraId) where.obraId = obraId;
            if (employeeId) where.employeeId = employeeId;
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
                    employee: { select: { id: true, name: true, firstName: true, lastName: true, dni: true } },
                    contractor: { select: { id: true, name: true, nif: true } }
                },
                take: cap
            });
            return ApiResponse.success(res, expenses);
        } catch (err: unknown) {
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al listar gastos', 500);
        }
    },

    generateReceipts: async (req: Request, res: Response) => {
        try {
            const userId = (req as AuthenticatedRequest).user?.id;
            if (!userId) throw new AppError('Usuario no autenticado', 401);
            const result = await ObraExpenseReceiptService.generate(req.body.expenseIds, userId);
            res.setHeader('Content-Type', result.contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.setHeader('Content-Length', String(result.buffer.length));
            return res.send(result.buffer);
        } catch (err: unknown) {
            if (err instanceof AppError) return ApiResponse.error(res, err.message, err.statusCode);
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al generar los recibís', 500);
        }
    }
};
