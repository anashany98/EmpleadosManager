
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthenticatedRequest } from '../types/express';

export const VehicleController = {
    getAll: async (req: Request, res: Response) => {
        try {
            const vehicles = await prisma.vehicle.findMany({
                include: { employee: true, company: true },
                orderBy: { plate: 'asc' }
            });
            return ApiResponse.success(res, vehicles);
        } catch (error) {
            return ApiResponse.error(res, 'Error al obtener vehículos', 500);
        }
    },

    getById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const vehicle = await prisma.vehicle.findUnique({
                where: { id },
                include: { employee: true, company: true }
            });
            if (!vehicle) return ApiResponse.error(res, 'Vehículo no encontrado', 404);
            return ApiResponse.success(res, vehicle);
        } catch (error) {
            return ApiResponse.error(res, 'Error al obtener vehículo', 500);
        }
    },

    create: async (req: Request, res: Response) => {
        try {
            const data = req.body;
            // Basic validation
            if (!data.plate || !data.make || !data.model) {
                return ApiResponse.error(res, 'Matrícula, Marca y Modelo son obligatorios', 400);
            }

            const existing = await prisma.vehicle.findUnique({ where: { plate: data.plate } });
            if (existing) return ApiResponse.error(res, 'Ya existe un vehículo con esa matrícula', 400);

            const vehicle = await prisma.vehicle.create({
                data: {
                    ...data,
                    // Parse dates if they come as strings? Prisma handles ISO strings usually.
                    year: data.year ? Number(data.year) : undefined,
                    currentMileage: data.currentMileage ? Number(data.currentMileage) : 0
                }
            });
            return ApiResponse.success(res, vehicle, 'Vehículo creado correctamente');
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al crear vehículo', 500);
        }
    },

    update: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const data = req.body;

            const vehicle = await prisma.vehicle.update({
                where: { id },
                data: {
                    ...data,
                    year: data.year ? Number(data.year) : undefined,
                    currentMileage: data.currentMileage ? Number(data.currentMileage) : undefined
                }
            });
            return ApiResponse.success(res, vehicle, 'Vehículo actualizado');
        } catch (error) {
            return ApiResponse.error(res, 'Error al actualizar vehículo', 500);
        }
    },

    delete: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await prisma.vehicle.delete({ where: { id } });
            return ApiResponse.success(res, null, 'Vehículo eliminado');
        } catch (error) {
            return ApiResponse.error(res, 'Error al eliminar vehículo', 500);
        }
    }
};
