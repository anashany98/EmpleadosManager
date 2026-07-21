
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { handleControllerError } from '../utils/controllerError';
import { AuthenticatedRequest } from '../types/express';
import { AppError } from '../utils/AppError';
import { assertCompanyAccess, isGlobalAdmin } from '../utils/companyAccess';

const hasOwn = (value: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(value, key);

const normalizeNullableString = (value: unknown) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    return String(value);
};

const normalizeLimit = (value: unknown) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    return Number(value);
};

const normalizeExpiryDate = (value: unknown) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    return new Date(String(value));
};

const buildCardUpdateData = (data: Record<string, unknown>, resolvedCompanyId?: string | null) => {
    const nextData: Record<string, unknown> = {};

    if (hasOwn(data, 'alias')) nextData.alias = data.alias ?? null;
    if (hasOwn(data, 'panLast4')) nextData.panLast4 = data.panLast4;
    if (hasOwn(data, 'encryptedPan')) nextData.encryptedPan = normalizeNullableString(data.encryptedPan);
    if (hasOwn(data, 'provider')) nextData.provider = data.provider;
    if (hasOwn(data, 'type')) nextData.type = data.type;
    if (hasOwn(data, 'limit')) nextData.limit = normalizeLimit(data.limit);
    if (hasOwn(data, 'currency')) nextData.currency = data.currency;
    if (hasOwn(data, 'expiryDate')) nextData.expiryDate = normalizeExpiryDate(data.expiryDate);
    if (hasOwn(data, 'employeeId')) nextData.employeeId = normalizeNullableString(data.employeeId);
    if (resolvedCompanyId !== undefined) nextData.companyId = resolvedCompanyId;
    else if (hasOwn(data, 'companyId')) nextData.companyId = normalizeNullableString(data.companyId);
    if (hasOwn(data, 'status')) nextData.status = data.status;
    if (hasOwn(data, 'pin')) nextData.pin = normalizeNullableString(data.pin);

    return nextData;
};

export const CardController = {
    getAll: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            let where: any = {};

            if (!isGlobalAdmin(user)) {
                if (!user.companyId) {
                    throw new AppError('Usuario sin empresa asignada', 403);
                }

                where = {
                    OR: [
                        { companyId: user.companyId },
                        { employee: { is: { companyId: user.companyId } } }
                    ]
                };
            }

            const cards = await prisma.card.findMany({
                where,
                include: { employee: true, company: true },
                orderBy: { createdAt: 'desc' }
            });
            return ApiResponse.success(res, cards);
        } catch (error: any) {
            return handleControllerError(res, error, 'Error al obtener tarjetas');
        }
    },

    getById: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const card = await prisma.card.findUnique({
                where: { id },
                include: { employee: true, company: true }
            });
            if (!card) return ApiResponse.error(res, 'Tarjeta no encontrada', 404);

            if (!isGlobalAdmin(user)) {
                const targetCompanyId = card.companyId || card.employee?.companyId;
                assertCompanyAccess(user, targetCompanyId, 'No autorizado para consultar tarjetas de otra empresa');
            }

            return ApiResponse.success(res, card);
        } catch (error: any) {
            return handleControllerError(res, error, 'Error al obtener tarjeta');
        }
    },

    create: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const data = req.body as Record<string, unknown>;
            const requestedEmployeeId = normalizeNullableString(data.employeeId);
            const requestedCompanyId = normalizeNullableString(data.companyId);
            if (!data.panLast4 || !data.provider || !data.alias) {
                return ApiResponse.error(res, 'Alias, Proveedor y Últimos 4 dígitos son obligatorios', 400);
            }

            const employeeCompanyId = requestedEmployeeId
                ? (await prisma.employee.findUnique({ where: { id: requestedEmployeeId }, select: { companyId: true } }))?.companyId
                : null;

            if (requestedEmployeeId && !employeeCompanyId) {
                throw new AppError('Empleado no encontrado', 404);
            }

            if (requestedCompanyId && employeeCompanyId && requestedCompanyId !== employeeCompanyId) {
                throw new AppError('La empresa de la tarjeta no coincide con la del empleado asignado', 400);
            }

            if (!isGlobalAdmin(user)) {
                const targetCompanyId = employeeCompanyId || requestedCompanyId;

                if (!targetCompanyId) {
                    throw new AppError('Debe indicar una empresa o un empleado de la misma empresa', 403);
                }

                assertCompanyAccess(user, targetCompanyId, 'No autorizado para crear tarjetas en otra empresa');
            }

            const card = await prisma.card.create({
                data: {
                    alias: String(data.alias),
                    panLast4: String(data.panLast4),
                    encryptedPan: normalizeNullableString(data.encryptedPan),
                    provider: String(data.provider),
                    type: data.type ? String(data.type) : 'CREDIT',
                    limit: data.limit === undefined ? 0 : Number(data.limit),
                    currency: data.currency ? String(data.currency) : 'EUR',
                    expiryDate: normalizeExpiryDate(data.expiryDate),
                    employeeId: requestedEmployeeId,
                    companyId: employeeCompanyId || requestedCompanyId,
                    status: data.status ? String(data.status) : 'ACTIVE',
                    pin: normalizeNullableString(data.pin)
                }
            });
            return ApiResponse.success(res, card, 'Tarjeta creada correctamente');
        } catch (error: any) {
            return handleControllerError(res, error, 'Error al crear tarjeta');
        }
    },

    update: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const data = req.body as Record<string, unknown>;
            const requestedEmployeeId = normalizeNullableString(data.employeeId);
            const requestedCompanyId = normalizeNullableString(data.companyId);

            const existing = await prisma.card.findUnique({
                where: { id },
                include: { employee: { select: { companyId: true } } }
            });

            if (!existing) {
                return ApiResponse.error(res, 'Tarjeta no encontrada', 404);
            }

            const employeeCompanyId = requestedEmployeeId
                ? (await prisma.employee.findUnique({ where: { id: requestedEmployeeId }, select: { companyId: true } }))?.companyId
                : null;

            if (requestedEmployeeId && !employeeCompanyId) {
                throw new AppError('Empleado no encontrado', 404);
            }

            if (requestedCompanyId && employeeCompanyId && requestedCompanyId !== employeeCompanyId) {
                throw new AppError('La empresa de la tarjeta no coincide con la del empleado asignado', 400);
            }

            if (!isGlobalAdmin(user)) {
                const targetCompanyId = employeeCompanyId || requestedCompanyId || existing.companyId || existing.employee?.companyId;

                assertCompanyAccess(user, targetCompanyId, 'No autorizado para actualizar tarjetas de otra empresa');
            }

            const resolvedCompanyId = employeeCompanyId
                || (hasOwn(data, 'companyId') ? requestedCompanyId : undefined);

            const card = await prisma.card.update({
                where: { id },
                data: buildCardUpdateData(data, resolvedCompanyId)
            });
            return ApiResponse.success(res, card, 'Tarjeta actualizada');
        } catch (error: any) {
            return handleControllerError(res, error, 'Error al actualizar tarjeta');
        }
    },

    delete: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;

            const existing = await prisma.card.findUnique({
                where: { id },
                include: { employee: { select: { companyId: true } } }
            });

            if (!existing) {
                return ApiResponse.error(res, 'Tarjeta no encontrada', 404);
            }

            if (!isGlobalAdmin(user)) {
                const targetCompanyId = existing.companyId || existing.employee?.companyId;
                assertCompanyAccess(user, targetCompanyId, 'No autorizado para eliminar tarjetas de otra empresa');
            }

            await prisma.card.delete({ where: { id } });
            return ApiResponse.success(res, null, 'Tarjeta eliminada');
        } catch (error: any) {
            return handleControllerError(res, error, 'Error al eliminar tarjeta');
        }
    }
};
