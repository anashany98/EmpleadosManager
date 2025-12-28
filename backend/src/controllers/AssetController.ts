import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';

export const AssetController = {
    getAll: async (req: Request, res: Response) => {
        const { employeeId } = req.query;
        try {
            const assets = await prisma.asset.findMany({
                where: employeeId ? { employeeId: String(employeeId) } : {},
                include: {
                    employee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            department: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            return ApiResponse.success(res, assets);
        } catch (error) {
            throw new AppError('Error al obtener activos', 500);
        }
    },

    create: async (req: Request, res: Response) => {
        const { employeeId, category, name, serialNumber, size, assignedDate, notes } = req.body;
        try {
            const asset = await prisma.asset.create({
                data: {
                    employeeId: employeeId || null,
                    category,
                    name,
                    serialNumber,
                    size,
                    assignedDate: assignedDate ? new Date(assignedDate) : null,
                    notes,
                    status: 'ASSIGNED'
                }
            });
            return ApiResponse.success(res, asset, 'Activo creado correctamente');
        } catch (error) {
            throw new AppError('Error al crear activo', 500);
        }
    },

    update: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { employeeId, category, name, serialNumber, size, assignedDate, returnDate, status, notes } = req.body;
        try {
            const asset = await prisma.asset.update({
                where: { id },
                data: {
                    employeeId: employeeId || null,
                    category,
                    name,
                    serialNumber,
                    size,
                    assignedDate: assignedDate ? new Date(assignedDate) : null,
                    returnDate: returnDate ? new Date(returnDate) : null,
                    status,
                    notes
                }
            });
            return ApiResponse.success(res, asset, 'Activo actualizado correctamente');
        } catch (error) {
            throw new AppError('Error al actualizar activo', 500);
        }
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            await prisma.asset.delete({ where: { id } });
            return ApiResponse.success(res, null, 'Activo eliminado correctamente');
        } catch (error) {
            throw new AppError('Error al eliminar activo', 500);
        }
    }
};
