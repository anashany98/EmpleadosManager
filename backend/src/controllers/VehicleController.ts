
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthenticatedRequest } from '../types/express';
import { AppError } from '../utils/AppError';
import { assertCompanyAccess, isGlobalAdmin } from '../utils/companyAccess';

export const VehicleController = {
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

            const vehicles = await prisma.vehicle.findMany({
                where,
                include: { employee: true, company: true },
                orderBy: { plate: 'asc' }
            });
            return ApiResponse.success(res, vehicles);
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al obtener vehículos', error.statusCode || 500);
        }
    },

    getById: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const vehicle = await prisma.vehicle.findUnique({
                where: { id },
                include: { employee: true, company: true }
            });
            if (!vehicle) return ApiResponse.error(res, 'Vehículo no encontrado', 404);

            if (!isGlobalAdmin(user)) {
                const targetCompanyId = vehicle.companyId || vehicle.employee?.companyId;
                assertCompanyAccess(user, targetCompanyId, 'No autorizado para consultar vehículos de otra empresa');
            }

            return ApiResponse.success(res, vehicle);
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al obtener vehículo', error.statusCode || 500);
        }
    },

    create: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const data = req.body;
            // Basic validation
            if (!data.plate || !data.make || !data.model) {
                return ApiResponse.error(res, 'Matrícula, Marca y Modelo son obligatorios', 400);
            }

            const employeeCompanyId = data.employeeId
                ? (await prisma.employee.findUnique({ where: { id: data.employeeId }, select: { companyId: true } }))?.companyId
                : null;

            if (data.employeeId && !employeeCompanyId) {
                throw new AppError('Empleado no encontrado', 404);
            }

            if (data.companyId && employeeCompanyId && data.companyId !== employeeCompanyId) {
                throw new AppError('La empresa del vehículo no coincide con la del empleado asignado', 400);
            }

            if (!isGlobalAdmin(user)) {
                const targetCompanyId = employeeCompanyId || data.companyId;

                if (!targetCompanyId) {
                    throw new AppError('Debe indicar una empresa o un empleado de la misma empresa', 403);
                }

                assertCompanyAccess(user, targetCompanyId, 'No autorizado para crear vehículos en otra empresa');
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
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const data = req.body;

            const existing = await prisma.vehicle.findUnique({
                where: { id },
                include: { employee: { select: { companyId: true } } }
            });

            if (!existing) {
                return ApiResponse.error(res, 'Vehículo no encontrado', 404);
            }

            const employeeCompanyId = data.employeeId
                ? (await prisma.employee.findUnique({ where: { id: data.employeeId }, select: { companyId: true } }))?.companyId
                : null;

            if (data.employeeId && !employeeCompanyId) {
                throw new AppError('Empleado no encontrado', 404);
            }

            if (data.companyId && employeeCompanyId && data.companyId !== employeeCompanyId) {
                throw new AppError('La empresa del vehículo no coincide con la del empleado asignado', 400);
            }

            if (!isGlobalAdmin(user)) {
                const targetCompanyId = employeeCompanyId || data.companyId || existing.companyId || existing.employee?.companyId;

                assertCompanyAccess(user, targetCompanyId, 'No autorizado para actualizar vehículos de otra empresa');
            }

            const vehicle = await prisma.vehicle.update({
                where: { id },
                data: {
                    ...data,
                    year: data.year ? Number(data.year) : undefined,
                    currentMileage: data.currentMileage ? Number(data.currentMileage) : undefined
                }
            });
            return ApiResponse.success(res, vehicle, 'Vehículo actualizado');
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al actualizar vehículo', error.statusCode || 500);
        }
    },

    delete: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;

            const existing = await prisma.vehicle.findUnique({
                where: { id },
                include: { employee: { select: { companyId: true } } }
            });

            if (!existing) {
                return ApiResponse.error(res, 'Vehículo no encontrado', 404);
            }

            if (!isGlobalAdmin(user)) {
                const targetCompanyId = existing.companyId || existing.employee?.companyId;
                assertCompanyAccess(user, targetCompanyId, 'No autorizado para eliminar vehículos de otra empresa');
            }

            await prisma.vehicle.delete({ where: { id } });
            return ApiResponse.success(res, null, 'Vehículo eliminado');
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al eliminar vehículo', error.statusCode || 500);
        }
    }
};
