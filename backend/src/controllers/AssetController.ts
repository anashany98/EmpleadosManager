import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../types/express';
import { assertCompanyAccess, isGlobalAdmin } from '../utils/companyAccess';
import { getPaginationParams, getPrismaPagination, buildPaginationMeta } from '../utils/pagination';
import { InventoryService } from '../services/InventoryService';
import { createLogger } from '../services/LoggerService';

const logger = createLogger('AssetController');

export const AssetController = {
    getAll: async (req: Request, res: Response) => {
        const { employeeId } = req.query;
        try {
            const { user } = req as AuthenticatedRequest;
            let where: any = {};

            if (employeeId) {
                const employee = await prisma.employee.findUnique({
                    where: { id: String(employeeId) },
                    select: { id: true, companyId: true }
                });

                if (!employee) {
                    throw new AppError('Empleado no encontrado', 404);
                }

                if (!isGlobalAdmin(user)) {
                    assertCompanyAccess(user, employee.companyId, 'No autorizado para consultar activos de otra empresa');
                }

                where = { employeeId: String(employeeId) };
            } else if (!isGlobalAdmin(user)) {
                if (!user.companyId) {
                    throw new AppError('Usuario sin empresa asignada', 403);
                }

                where = {
                    employee: {
                        is: {
                            companyId: user.companyId
                        }
                    }
                };
            }

            const pagination = getPaginationParams(req);
            const prismaPagination = getPrismaPagination(pagination);

            const [total, assets] = await Promise.all([
                prisma.asset.count({ where }),
                prisma.asset.findMany({
                    where,
                    include: {
                        employee: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                department: true
                            }
                        },
                        inventoryItem: true
                    },
                    orderBy: { createdAt: 'desc' },
                    ...prismaPagination
                })
            ]);

            if (pagination.isPaginationRequested) {
                return ApiResponse.success(res, {
                    data: assets,
                    meta: buildPaginationMeta(total, pagination)
                });
            }

            return ApiResponse.success(res, assets);
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError('Error al obtener activos', 500);
        }
    },

    create: async (req: Request, res: Response) => {
        const { employeeId, category, name, serialNumber, size, assignedDate, notes } = req.body;
        try {
            const { user } = req as AuthenticatedRequest;

            if (!isGlobalAdmin(user)) {
                if (!employeeId) {
                    throw new AppError('Los activos sin empleado asignado solo pueden gestionarlos administradores globales', 403);
                }

                const employee = await prisma.employee.findUnique({
                    where: { id: employeeId },
                    select: { companyId: true }
                });

                if (!employee) {
                    throw new AppError('Empleado no encontrado', 404);
                }

                assertCompanyAccess(user, employee.companyId, 'No autorizado para asignar activos a otra empresa');
            }

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
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError('Error al crear activo', 500);
        }
    },

    update: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { employeeId, category, name, serialNumber, size, assignedDate, returnDate, status, notes } = req.body;
        try {
            const { user } = req as AuthenticatedRequest;
            const existing = await prisma.asset.findUnique({
                where: { id },
                include: {
                    employee: {
                        select: {
                            companyId: true
                        }
                    }
                }
            });

            if (!existing) {
                throw new AppError('Activo no encontrado', 404);
            }

            if (!isGlobalAdmin(user)) {
                const effectiveEmployeeId = employeeId ?? existing.employeeId;
                if (!effectiveEmployeeId) {
                    throw new AppError('Los activos sin empleado asignado solo pueden gestionarlos administradores globales', 403);
                }

                const employee = await prisma.employee.findUnique({
                    where: { id: effectiveEmployeeId },
                    select: { companyId: true }
                });

                if (!employee) {
                    throw new AppError('Empleado no encontrado', 404);
                }

                assertCompanyAccess(user, employee.companyId, 'No autorizado para modificar activos de otra empresa');
            }

            // Semántica parcial: solo se actualizan los campos presentes en
            // el body. Un PUT incompleto ya no desasigna el empleado ni
            // borra fechas por omisión (employeeId: null explícito sí desasigna).
            const data: Record<string, unknown> = {};
            if (employeeId !== undefined) data.employeeId = employeeId || null;
            if (category !== undefined) data.category = category;
            if (name !== undefined) data.name = name;
            if (serialNumber !== undefined) data.serialNumber = serialNumber;
            if (size !== undefined) data.size = size;
            if (assignedDate !== undefined) data.assignedDate = assignedDate ? new Date(assignedDate) : null;
            if (returnDate !== undefined) data.returnDate = returnDate ? new Date(returnDate) : null;
            if (status !== undefined) data.status = status;
            if (notes !== undefined) data.notes = notes;

            const asset = await prisma.asset.update({
                where: { id },
                data
            });
            return ApiResponse.success(res, asset, 'Activo actualizado correctamente');
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError('Error al actualizar activo', 500);
        }
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const { user } = req as AuthenticatedRequest;
            const existing = await prisma.asset.findUnique({
                where: { id },
                include: {
                    employee: {
                        select: {
                            companyId: true
                        }
                    },
                    inventoryItem: true
                }
            });

            if (!existing) {
                throw new AppError('Activo no encontrado', 404);
            }

            if (!isGlobalAdmin(user)) {
                const companyId = existing.employee?.companyId;
                if (!companyId) {
                    throw new AppError('Los activos sin empleado asignado solo pueden gestionarlos administradores globales', 403);
                }

                assertCompanyAccess(user, companyId, 'No autorizado para eliminar activos de otra empresa');
            }

            // If asset is linked to inventory, return it to stock before deletion
            if (existing.inventoryItemId && existing.status === 'ASSIGNED') {
                try {
                    await InventoryService.returnAsset(id, user.id, 'Eliminación de activo');
                } catch (returnError) {
                    logger.warn({ error: returnError }, 'Failed to return asset to inventory during deletion');
                    // Continue with deletion even if return fails
                }
            }

            await prisma.asset.delete({ where: { id } });
            return ApiResponse.success(res, null, 'Activo eliminado correctamente');
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError('Error al eliminar activo', 500);
        }
    },

    returnAsset: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const { user } = req as AuthenticatedRequest;
            const existing = await prisma.asset.findUnique({
                where: { id },
                include: {
                    employee: {
                        select: {
                            companyId: true
                        }
                    },
                    inventoryItem: true
                }
            });

            if (!existing) {
                throw new AppError('Activo no encontrado', 404);
            }

            if (!isGlobalAdmin(user)) {
                const companyId = existing.employee?.companyId;
                if (!companyId) {
                    throw new AppError('Los activos sin empleado asignado solo pueden gestionarlos administradores globales', 403);
                }

                assertCompanyAccess(user, companyId, 'No autorizado para devolver activos de otra empresa');
            }

            if (existing.status !== 'ASSIGNED') {
                throw new AppError('Solo se pueden devolver activos con estado ASIGNADO', 400);
            }

            const result = await InventoryService.returnAsset(id, user.id, 'Devolución normal');

            return ApiResponse.success(res, result, 'Activo devuelto correctamente');
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError('Error al devolver activo', 500);
        }
    }
};
