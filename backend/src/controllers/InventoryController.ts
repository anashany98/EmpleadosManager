import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';

export const InventoryController = {
    getAll: async (req: Request, res: Response) => {
        try {
            const items = await prisma.inventoryItem.findMany({
                orderBy: { name: 'asc' }
            });
            return ApiResponse.success(res, items);
        } catch (error: any) {
            console.error('Error fetching inventory:', error);
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
                    quantity: Number(quantity),
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
                        userId: (req as any).user?.id,
                        notes: 'Stock inicial'
                    }
                });
            }

            return ApiResponse.success(res, item, 'Producto creado', 201);
        } catch (error: any) {
            console.error('Error creating inventory item:', error);
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
            console.error('Error updating inventory item:', error);
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
            console.error('Error deleting inventory item:', error);
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

            const item = await prisma.inventoryItem.update({
                where: { id },
                data: {
                    quantity: { increment: Number(amount) }
                }
            });

            await prisma.inventoryMovement.create({
                data: {
                    inventoryItemId: id,
                    type: 'ENTRY',
                    quantity: Number(amount),
                    userId: (req as any).user?.id,
                    notes: notes || 'Actualización de stock'
                }
            });

            return ApiResponse.success(res, item, 'Stock actualizado');
        } catch (error: any) {
            console.error('Error adding stock:', error);
            return ApiResponse.error(res, error.message || 'Error al reponer stock', 500);
        }
    },

    distribute: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { employeeId, quantity, notes, serialNumber } = req.body;
            const userId = (req as any).user?.id;

            if (!employeeId || !quantity || Number(quantity) <= 0) {
                return ApiResponse.error(res, 'Faltan parámetros de distribución', 400);
            }

            const item = await prisma.inventoryItem.findUnique({ where: { id } });
            if (!item || item.quantity < Number(quantity)) {
                return ApiResponse.error(res, 'Stock insuficiente', 400);
            }

            const [updatedItem, asset] = await prisma.$transaction([
                prisma.inventoryItem.update({
                    where: { id },
                    data: { quantity: { decrement: Number(quantity) } }
                }),
                prisma.asset.create({
                    data: {
                        employeeId,
                        name: item.name,
                        category: item.category,
                        serialNumber: serialNumber || undefined,
                        status: 'ASSIGNED',
                        inventoryItemId: id
                    }
                }),
                prisma.inventoryMovement.create({
                    data: {
                        inventoryItemId: id,
                        employeeId,
                        type: 'ASSIGNMENT',
                        quantity: Number(quantity),
                        userId,
                        notes
                    }
                })
            ]);

            return ApiResponse.success(res, { updatedItem, asset }, 'Artículo distribuido correctamente');
        } catch (error: any) {
            console.error('Error distributing item:', error);
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
            const { id } = req.params; // movementId or assetId? Let's use it for the general data
            const { employeeId, deviceName, serialNumber } = req.body;

            if (!employeeId || !deviceName) {
                return ApiResponse.error(res, 'Faltan datos para generar el acta', 400);
            }

            const { DocumentTemplateService } = require('../services/DocumentTemplateService');
            const filePath = await DocumentTemplateService.generateTechDeviceInternal(employeeId, deviceName, serialNumber || 'N/A');

            res.download(filePath);
        } catch (error: any) {
            console.error('Error generating tech receipt:', error);
            return ApiResponse.error(res, 'Error al generar el acta de entrega', 500);
        }
    }
};
