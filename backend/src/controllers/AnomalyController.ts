import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';

const parseReasons = (reasons: string | null) => {
    if (!reasons) return [];
    try {
        return JSON.parse(reasons);
    } catch {
        return [];
    }
};

export const AnomalyController = {
    getAll: async (req: Request, res: Response) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const skip = (page - 1) * limit;
            const status = req.query.status as string | undefined;
            const entityType = req.query.entityType as string | undefined;

            const where: any = {};
            if (status) where.status = status;
            if (entityType) where.entityType = entityType;

            const [total, rows] = await Promise.all([
                prisma.anomalyEvent.count({ where }),
                prisma.anomalyEvent.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                    include: {
                        employee: {
                            select: { id: true, name: true, firstName: true, lastName: true }
                        }
                    }
                })
            ]);

            const data = rows.map(r => ({
                ...r,
                reasons: parseReasons(r.reasons)
            }));

            return ApiResponse.success(res, {
                data,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error(error);
            return ApiResponse.error(res, 'Error al obtener anomalías', 500);
        }
    },

    getByEmployee: async (req: Request, res: Response) => {
        try {
            const { employeeId } = req.params;
            const status = req.query.status as string | undefined;

            const where: any = { employeeId };
            if (status) where.status = status;

            const rows = await prisma.anomalyEvent.findMany({
                where,
                orderBy: { createdAt: 'desc' }
            });

            const data = rows.map(r => ({
                ...r,
                reasons: parseReasons(r.reasons)
            }));

            return ApiResponse.success(res, data);
        } catch (error) {
            console.error(error);
            return ApiResponse.error(res, 'Error al obtener anomalías del empleado', 500);
        }
    },

    updateStatus: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!['OPEN', 'REVIEWED', 'RESOLVED', 'FALSE_POSITIVE'].includes(status)) {
                return ApiResponse.error(res, 'Estado inválido', 400);
            }

            const updated = await prisma.anomalyEvent.update({
                where: { id },
                data: { status }
            });

            return ApiResponse.success(res, updated, 'Estado actualizado');
        } catch (error) {
            console.error(error);
            return ApiResponse.error(res, 'Error al actualizar estado', 500);
        }
    }
};

