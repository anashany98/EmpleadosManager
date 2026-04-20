import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';
import { InventoryService } from '../services/InventoryService';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';
import { DocumentTemplateService } from '../services/DocumentTemplateService';
import { getPaginationParams, getPrismaPagination, buildPaginationMeta } from '../utils/pagination';

const log = createLogger('InventoryController');

export const InventoryController = {
    getAll: async (req: Request, res: Response) => {
        try {
            const pagination = getPaginationParams(req);
            const prismaPagination = getPrismaPagination(pagination);

            const [total, items] = await Promise.all([
                prisma.inventoryItem.count(),
                prisma.inventoryItem.findMany({
                    orderBy: { name: 'asc' },
                    ...prismaPagination
                })
            ]);

            if (pagination.isPaginationRequested) {
                return ApiResponse.success(res, {
                    data: items,
                    meta: buildPaginationMeta(total, pagination)
                });
            }

            return ApiResponse.success(res, items);
        } catch (error: any) {
            log.error({ error }, 'Error fetching inventory');
            return ApiResponse.error(res, 'Error al obtener el inventario', 500);
        }
    },

    create: async (req: Request, res: Response) => {
        try {
            const { category, name, quantity, minQuantity, description, size } = req.body;

            const existing = await prisma.inventoryItem.findFirst({
                where: {
                    name,
                    size: size || null
                }
            });

            if (existing) {
                return ApiResponse.error(res, 'Ya existe un producto con ese nombre y talla en el inventario', 400);
            }

            const item = await prisma.inventoryItem.create({
                data: {
                    category,
                    name,
                    quantity: Number(quantity) || 0,
                    minQuantity: Number(minQuantity),
                    description,
                    size
                }
            });

            if (Number(quantity) > 0) {
                await prisma.inventoryMovement.create({
                    data: {
                        inventoryItemId: item.id,
                        type: 'ENTRY',
                        quantity: Number(quantity),
                        userId: (req as AuthenticatedRequest).user?.id,
                        notes: 'Stock inicial'
                    }
                });
            }

            return ApiResponse.success(res, item, 'Producto creado', 201);
        } catch (error: any) {
            log.error({ error }, 'Error creating inventory item');
            return ApiResponse.error(res, error.message || 'Error al crear el producto', 500);
        }
    },

    update: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { category, name, quantity, minQuantity, description, size } = req.body;

            const item = await prisma.inventoryItem.update({
                where: { id },
                data: {
                    category,
                    name,
                    quantity: Number(quantity),
                    minQuantity: Number(minQuantity),
                    description,
                    size
                }
            });

            return ApiResponse.success(res, item);
        } catch (error: any) {
            log.error({ error }, 'Error updating inventory item');
            return ApiResponse.error(res, error.message || 'Error al actualizar el producto', 500);
        }
    },

    delete: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await prisma.inventoryItem.delete({
                where: { id }
            });
            return ApiResponse.success(res, null, 'Producto eliminado correctamente');
        } catch (error: any) {
            log.error({ error }, 'Error deleting inventory item');
            return ApiResponse.error(res, 'Error al eliminar el producto', 500);
        }
    },

    addStock: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { amount, notes } = req.body;

            if (!amount || Number(amount) <= 0) {
                return ApiResponse.error(res, 'Cantidad inválida', 400);
            }

            const item = await prisma.$transaction(async (tx) => {
                const current = await tx.inventoryItem.findUnique({ where: { id } });
                if (!current) {
                    throw new AppError('Producto no encontrado', 404);
                }

                await tx.inventoryMovement.create({
                    data: {
                        inventoryItemId: id,
                        type: 'ENTRY',
                        quantity: Number(amount),
                        userId: (req as AuthenticatedRequest).user?.id,
                        notes: notes || 'Actualización de stock'
                    }
                });

                return tx.inventoryItem.update({
                    where: { id },
                    data: { quantity: { increment: Number(amount) } }
                });
            });

            return ApiResponse.success(res, item, 'Stock actualizado');
        } catch (error: any) {
            if (error.statusCode === 404) {
                return ApiResponse.error(res, error.message, 404);
            }
            log.error({ error }, 'Error adding stock');
            return ApiResponse.error(res, error.message || 'Error al reponer stock', 500);
        }
    },

    distribute: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { employeeId, quantity, notes, serialNumber } = req.body;
            const userId = (req as AuthenticatedRequest).user?.id;

            if (!employeeId || !quantity || Number(quantity) <= 0) {
                return ApiResponse.error(res, 'Faltan parámetros de distribución', 400);
            }

            await prisma.$transaction(async (tx) => {
                const item = await tx.inventoryItem.findUnique({ where: { id } });
                if (!item || item.quantity < Number(quantity)) {
                    throw new AppError('Stock insuficiente', 400);
                }

                await tx.asset.create({
                    data: {
                        employeeId,
                        name: item.name,
                        category: item.category,
                        serialNumber: serialNumber || undefined,
                        status: 'ASSIGNED',
                        inventoryItemId: id
                    }
                });

                await tx.inventoryMovement.create({
                    data: {
                        inventoryItemId: id,
                        type: 'ASSIGNMENT',
                        quantity: Number(quantity),
                        userId,
                        employeeId,
                        notes
                    }
                });

                await tx.inventoryItem.update({
                    where: { id },
                    data: { quantity: { decrement: Number(quantity) } }
                });
            });

            const updatedItem = await prisma.inventoryItem.findUnique({ where: { id } });

            return ApiResponse.success(res, { updatedItem }, 'Artículo distribuido correctamente');
        } catch (error: any) {
            if (error.message === 'Stock insuficiente') {
                return ApiResponse.error(res, error.message, 400);
            }
            log.error({ error }, 'Error distributing item');
            return ApiResponse.error(res, error.message || 'Error al distribuir artículo', 500);
        }
    },

    getMovements: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const movements = await prisma.inventoryMovement.findMany({
                where: { inventoryItemId: id },
                orderBy: { createdAt: 'desc' },
                include: {
                    inventoryItem: { select: { name: true } }
                }
            });
            return ApiResponse.success(res, movements);
        } catch (error: any) {
            return ApiResponse.error(res, 'Error al obtener movimientos', 500);
        }
    },

    generateReceipt: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { employeeId, deviceName, serialNumber } = req.body;

            if (!employeeId) {
                return ApiResponse.error(res, 'Faltan datos para generar el acta', 400);
            }

            // Fetch item to get category
            const item = await prisma.inventoryItem.findUnique({ where: { id } });
            if (!item) {
                return ApiResponse.error(res, 'Artículo no encontrado', 404);
            }

            let docRecord;

            // Route to correct template based on category
            if (item.category === 'TECH') {
                docRecord = await DocumentTemplateService.generateTechDeviceInternal(
                    employeeId,
                    deviceName || item.name,
                    serialNumber || 'N/A'
                );
            } else if (item.category === 'EPI') {
                docRecord = await DocumentTemplateService.generateEPIInternal(
                    employeeId,
                    [{ name: deviceName || item.name, size: item.size || undefined }]
                );
            } else if (['CLOTHING', 'UNIFORM', 'UNIFORME'].includes(item.category)) {
                docRecord = await DocumentTemplateService.generateUniformInternal(
                    employeeId,
                    [{ name: deviceName || item.name, size: item.size || undefined }]
                );
            } else {
                docRecord = await DocumentTemplateService.generateEPIInternal(
                    employeeId,
                    [{ name: deviceName || item.name, size: item.size || undefined }]
                );
            }

            if (!docRecord || !docRecord.fileUrl) {
                throw new Error('Error al generar el registro del documento');
            }

            const filePath = path.join(process.cwd(), 'uploads', docRecord.fileUrl);

            if (fs.existsSync(filePath)) {
                res.download(filePath);
            } else {
                log.error({ filePath }, 'Generated file not found on disk');
                return ApiResponse.error(res, 'El archivo generado no se encuentra en el servidor', 500);
            }

        } catch (error: any) {
            log.error({ error }, 'Error generating receipt');
            return ApiResponse.error(res, 'Error al generar el acta de entrega', 500);
        }
    }
};
