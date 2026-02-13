
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthenticatedRequest } from '../types/express';

export const CardController = {
    getAll: async (req: Request, res: Response) => {
        try {
            const cards = await prisma.card.findMany({
                include: { employee: true, company: true },
                orderBy: { createdAt: 'desc' }
            });
            return ApiResponse.success(res, cards);
        } catch (error) {
            return ApiResponse.error(res, 'Error al obtener tarjetas', 500);
        }
    },

    getById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const card = await prisma.card.findUnique({
                where: { id },
                include: { employee: true, company: true }
            });
            if (!card) return ApiResponse.error(res, 'Tarjeta no encontrada', 404);
            return ApiResponse.success(res, card);
        } catch (error) {
            return ApiResponse.error(res, 'Error al obtener tarjeta', 500);
        }
    },

    create: async (req: Request, res: Response) => {
        try {
            const data = req.body;
            if (!data.panLast4 || !data.provider || !data.alias) {
                return ApiResponse.error(res, 'Alias, Proveedor y Últimos 4 dígitos son obligatorios', 400);
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
            const { id } = req.params;
            const data = req.body;

            const card = await prisma.card.update({
                where: { id },
                data: {
                    ...data,
                    limit: data.limit ? Number(data.limit) : undefined
                }
            });
            return ApiResponse.success(res, card, 'Tarjeta actualizada');
        } catch (error) {
            return ApiResponse.error(res, 'Error al actualizar tarjeta', 500);
        }
    },

    delete: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await prisma.card.delete({ where: { id } });
            return ApiResponse.success(res, null, 'Tarjeta eliminada');
        } catch (error) {
            return ApiResponse.error(res, 'Error al eliminar tarjeta', 500);
        }
    }
};
