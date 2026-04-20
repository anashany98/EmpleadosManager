
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthenticatedRequest } from '../types/express';
import { AppError } from '../utils/AppError';
import { assertCompanyAccess, isGlobalAdmin } from '../utils/companyAccess';

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
            return ApiResponse.error(res, error.message || 'Error al obtener tarjetas', error.statusCode || 500);
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
            return ApiResponse.error(res, error.message || 'Error al obtener tarjeta', error.statusCode || 500);
        }
    },

    create: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const data = req.body;
            if (!data.panLast4 || !data.provider || !data.alias) {
                return ApiResponse.error(res, 'Alias, Proveedor y Últimos 4 dígitos son obligatorios', 400);
            }

            const employeeCompanyId = data.employeeId
                ? (await prisma.employee.findUnique({ where: { id: data.employeeId }, select: { companyId: true } }))?.companyId
                : null;

            if (data.employeeId && !employeeCompanyId) {
                throw new AppError('Empleado no encontrado', 404);
            }

            if (data.companyId && employeeCompanyId && data.companyId !== employeeCompanyId) {
                throw new AppError('La empresa de la tarjeta no coincide con la del empleado asignado', 400);
            }

            if (!isGlobalAdmin(user)) {
                const targetCompanyId = employeeCompanyId || data.companyId;

                if (!targetCompanyId) {
                    throw new AppError('Debe indicar una empresa o un empleado de la misma empresa', 403);
                }

                assertCompanyAccess(user, targetCompanyId, 'No autorizado para crear tarjetas en otra empresa');
            }

            const card = await prisma.card.create({
                data: {
                    ...data,
                    limit: data.limit ? Number(data.limit) : 0
                }
            });
            return ApiResponse.success(res, card, 'Tarjeta creada correctamente');
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al crear tarjeta', 500);
        }
    },

    update: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const data = req.body;

            const existing = await prisma.card.findUnique({
                where: { id },
                include: { employee: { select: { companyId: true } } }
            });

            if (!existing) {
                return ApiResponse.error(res, 'Tarjeta no encontrada', 404);
            }

            const employeeCompanyId = data.employeeId
                ? (await prisma.employee.findUnique({ where: { id: data.employeeId }, select: { companyId: true } }))?.companyId
                : null;

            if (data.employeeId && !employeeCompanyId) {
                throw new AppError('Empleado no encontrado', 404);
            }

            if (data.companyId && employeeCompanyId && data.companyId !== employeeCompanyId) {
                throw new AppError('La empresa de la tarjeta no coincide con la del empleado asignado', 400);
            }

            if (!isGlobalAdmin(user)) {
                const targetCompanyId = employeeCompanyId || data.companyId || existing.companyId || existing.employee?.companyId;

                assertCompanyAccess(user, targetCompanyId, 'No autorizado para actualizar tarjetas de otra empresa');
            }

            const card = await prisma.card.update({
                where: { id },
                data: {
                    ...data,
                    limit: data.limit ? Number(data.limit) : undefined
                }
            });
            return ApiResponse.success(res, card, 'Tarjeta actualizada');
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al actualizar tarjeta', error.statusCode || 500);
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
            return ApiResponse.error(res, error.message || 'Error al eliminar tarjeta', error.statusCode || 500);
        }
    }
};
