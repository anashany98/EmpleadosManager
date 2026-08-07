import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import fs from 'fs';
import { ApiResponse } from '../utils/ApiResponse';
import { handleControllerError } from '../utils/controllerError';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';
import { DocumentTemplateService } from '../services/DocumentTemplateService';
import { getPaginationParams, getPrismaPagination, buildPaginationMeta } from '../utils/pagination';
import multer from 'multer';
import { serveLocalUploadFile } from '../utils/fileDownload';

const log = createLogger('InventoryController');

/**
 * Alias de cabeceras aceptadas en la importación CSV. Permite que un
 * CSV exportado por la propia app (p.ej. "Stock Minimo", "Precio
 * Unitario") se pueda reimportar sin perder columnas, además de las
 * variantes en inglés.
 */
const CSV_HEADER_ALIASES: Record<string, string> = {
    nombre: 'nombre', name: 'nombre',
    categoria: 'categoria', category: 'categoria',
    cantidad: 'cantidad', quantity: 'cantidad',
    minimo: 'minimo', 'stock minimo': 'minimo', 'min quantity': 'minimo', minquantity: 'minimo',
    talla: 'talla', size: 'talla',
    sku: 'sku', referencia: 'sku',
    marca: 'marca', brand: 'marca',
    precio: 'precio', price: 'precio', 'precio unitario': 'precio',
    proveedor: 'proveedor', supplier: 'proveedor',
    ubicacion: 'ubicacion', location: 'ubicacion',
    descripcion: 'descripcion', description: 'descripcion'
};

/**
 * Parser CSV mínimo con soporte de campos entrecomillados (RFC 4180):
 * comas dentro de comillas, comillas escapadas ("") y saltos de línea
 * dentro de campos. Devuelve filas de campos ya recortados.
 */
function parseCsv(content: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < content.length; i++) {
        const ch = content[i];
        if (inQuotes) {
            if (ch === '"') {
                if (content[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            row.push(field.trim());
            field = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && content[i + 1] === '\n') i++;
            row.push(field.trim());
            field = '';
            if (row.some(f => f !== '')) rows.push(row);
            row = [];
        } else {
            field += ch;
        }
    }
    if (field !== '' || row.length > 0) {
        row.push(field.trim());
        if (row.some(f => f !== '')) rows.push(row);
    }
    return rows;
}

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
        } catch (error) {
            log.error({ error }, 'Error fetching inventory');
            return ApiResponse.error(res, 'Error al obtener el inventario', 500);
        }
    },

  create: async (req: Request, res: Response) => {
    try {
      const { category, name, quantity, minQuantity, description, size, unitPrice, type, brand, sku, supplier, warehouseLocation } = req.body;

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
          size,
          unitPrice: unitPrice ? Number(unitPrice) : null,
          type: type || null,
          brand: brand || null,
          sku: sku || null,
          supplier: supplier || null,
          warehouseLocation: warehouseLocation || null
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
        } catch (error) {
            log.error({ error }, 'Error creating inventory item');
            return ApiResponse.error(res, (error as Error).message || 'Error al crear el producto', 500);
        }
    },

  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { category, name, quantity, minQuantity, description, size, unitPrice, type, brand, sku, supplier, warehouseLocation } = req.body;
      const userId = (req as AuthenticatedRequest).user?.id;

      const data: any = {};
      if (category !== undefined) data.category = category;
      if (name !== undefined) data.name = name;
      if (minQuantity !== undefined) data.minQuantity = Number(minQuantity);
      if (description !== undefined) data.description = description;
      if (size !== undefined) data.size = size;
      if (unitPrice !== undefined) data.unitPrice = unitPrice;
      if (type !== undefined) data.type = type;
      if (brand !== undefined) data.brand = brand;
      if (sku !== undefined) data.sku = sku;
      if (supplier !== undefined) data.supplier = supplier;
      if (warehouseLocation !== undefined) data.warehouseLocation = warehouseLocation;

      // La cantidad nunca se modifica en silencio: si cambia, se registra
      // un movimiento ADJUSTMENT en la misma transacción para mantener la
      // trazabilidad del stock (el historial y la cantidad no deben divergir).
      const item = await prisma.$transaction(async (tx) => {
        if (quantity !== undefined) {
          const current = await tx.inventoryItem.findUnique({
            where: { id },
            select: { quantity: true }
          });
          if (!current) {
            throw new AppError('Producto no encontrado', 404);
          }
          const delta = Number(quantity) - current.quantity;
          if (delta !== 0) {
            await tx.inventoryMovement.create({
              data: {
                inventoryItemId: id,
                type: 'ADJUSTMENT',
                quantity: delta,
                userId,
                notes: 'Ajuste de stock desde edición de producto'
              }
            });
            data.quantity = { increment: delta };
          }
        }
        return tx.inventoryItem.update({ where: { id }, data });
      });

      return ApiResponse.success(res, item);
    } catch (error: any) {
      log.error({ error }, 'Error updating inventory item');
      return handleControllerError(res, error, 'Error al actualizar el producto');
    }
  },

    delete: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            // Bloquear el borrado si hay CUALQUIER activo vinculado
            // (asignado o devuelto). El historial de entregas es
            // auditable y no debe desaparecer solo porque se retira
            // el producto del catálogo.
            const assetCount = await prisma.asset.count({
                where: { inventoryItemId: id }
            });
            if (assetCount > 0) {
                const assigned = await prisma.asset.count({
                    where: { inventoryItemId: id, status: 'ASSIGNED' }
                });
                const msg = assigned > 0
                    ? `No se puede eliminar: hay ${assigned} activo(s) asignado(s) de este producto. Devuélvelos primero.`
                    : `No se puede eliminar: hay ${assetCount} registro(s) historico(s) vinculado(s) a este producto.`;
                return ApiResponse.error(res, msg, 400);
            }

            await prisma.inventoryItem.delete({
                where: { id }
            });
            return ApiResponse.success(res, null, 'Producto eliminado correctamente');
        } catch (error) {
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
        } catch (error) {
            if ((error as any).statusCode === 404) {
                return ApiResponse.error(res, (error as Error).message, 404);
            }
            log.error({ error }, 'Error adding stock');
            return ApiResponse.error(res, (error as Error).message || 'Error al reponer stock', 500);
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

                // Un Asset por unidad: cada devolución repone exactamente 1
                // unidad, así el stock nunca descuadra al distribuir N > 1.
                for (let i = 0; i < Number(quantity); i++) {
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
                }

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
        } catch (error) {
            if ((error as Error).message === 'Stock insuficiente') {
                return ApiResponse.error(res, (error as Error).message, 400);
            }
            log.error({ error }, 'Error distributing item');
            return ApiResponse.error(res, (error as Error).message || 'Error al distribuir artículo', 500);
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
        } catch (error) {
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
                    serialNumber || 'N/A',
                    undefined,
                    item.imei || undefined
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

            // MED-007/barrido: helper compartido que valida
            // contención de path, sanitiza el nombre de descarga
            // y maneja errores de stream. Aquí no tenemos un
            // downloadName user-controlled (es un PDF generado
            // server-side), pero el basename sanitizado es seguro.
            return serveLocalUploadFile(res, docRecord.fileUrl);

        } catch (error) {
            log.error({ error }, 'Error generating receipt');
            return ApiResponse.error(res, 'Error al generar el acta de entrega', 500);
        }
    },

    withdraw: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { amount, notes } = req.body;
            const userId = (req as AuthenticatedRequest).user?.id;

            if (!amount || Number(amount) <= 0) {
                return ApiResponse.error(res, 'Cantidad invalida', 400);
            }

            const item = await prisma.$transaction(async (tx) => {
                const current = await tx.inventoryItem.findUnique({ where: { id } });
                if (!current) {
                    throw new AppError('Producto no encontrado', 404);
                }
                if (current.quantity < Number(amount)) {
                    throw new AppError('Stock insuficiente', 400);
                }

                await tx.inventoryMovement.create({
                    data: {
                        inventoryItemId: id,
                        type: 'EXIT',
                        quantity: Number(amount),
                        userId,
                        notes: notes || 'Retiro de stock'
                    }
                });

                return tx.inventoryItem.update({
                    where: { id },
                    data: { quantity: { decrement: Number(amount) } }
                });
            });

            return ApiResponse.success(res, item, 'Stock retirado');
        } catch (error) {
            if ((error as any).statusCode === 404) return ApiResponse.error(res, (error as Error).message, 404);
            if ((error as any).statusCode === 400) return ApiResponse.error(res, (error as Error).message, 400);
            log.error({ error }, 'Error withdrawing stock');
            return ApiResponse.error(res, (error as Error).message || 'Error al retirar stock', 500);
        }
    },

    uploadImage: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            if (!req.file) {
                return ApiResponse.error(res, 'No se ha subido ningun archivo', 400);
            }

            const imageUrl = `/uploads/inventory/${req.file.filename}`;
            const item = await prisma.inventoryItem.update({
                where: { id },
                data: { imageUrl }
            });

            return ApiResponse.success(res, item, 'Imagen actualizada');
        } catch (error) {
            log.error({ error }, 'Error uploading image');
            return ApiResponse.error(res, 'Error al subir imagen', 500);
        }
    },

    importCsv: async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                return ApiResponse.error(res, 'No se ha subido ningun archivo', 400);
            }

            // replace(/^\uFEFF/, ...): los CSV exportados desde Excel llevan
            // BOM UTF-8; sin quitarlo la primera cabecera nunca coincide.
            const content = fs.readFileSync(req.file.path, 'utf-8').replace(/^\uFEFF/, '');
            const csvRows = parseCsv(content);
            if (csvRows.length < 2) {
                return ApiResponse.error(res, 'El CSV esta vacio o no tiene cabeceras', 400);
            }

            const headers = csvRows[0].map(h => {
                const clean = h.toLowerCase().replace(/^['"]|['"]$/g, '').trim();
                return CSV_HEADER_ALIASES[clean] ?? clean;
            });
            const results = { created: 0, errors: 0, errorDetails: [] as string[] };
            const userId = (req as AuthenticatedRequest).user?.id;

            for (let i = 1; i < csvRows.length; i++) {
                try {
                    const values = csvRows[i];
                    const row: Record<string, string> = {};
                    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

                    const name = row.nombre || row.name || '';
                    if (!name) { results.errors++; results.errorDetails.push(`Fila ${i + 1}: sin nombre`); continue; }

                    const qty = Number(row.cantidad || row.quantity || 0);
                    if (!Number.isInteger(qty) || qty < 0) {
                        results.errors++;
                        results.errorDetails.push(`Fila ${i + 1}: cantidad invalida ("${row.cantidad || row.quantity || ''}")`);
                        continue;
                    }
                    const minQtyRaw = Number(row.minimo || row.minQuantity);
                    const minQuantity = Number.isInteger(minQtyRaw) && minQtyRaw >= 0 ? minQtyRaw : 5;

                    const existing = await prisma.inventoryItem.findFirst({ where: { name, size: row.talla || row.size || null } });
                    if (existing) {
                        await prisma.inventoryItem.update({
                            where: { id: existing.id },
                            data: {
                                quantity: { increment: qty },
                                category: row.categoria || row.category || existing.category,
                                sku: row.sku || existing.sku,
                                brand: row.marca || row.brand || existing.brand,
                                unitPrice: row.precio || row.price ? Number(row.precio || row.price) : existing.unitPrice
                            }
                        });
                        // El incremento de stock queda registrado como ENTRY
                        // para mantener la trazabilidad del inventario.
                        if (qty > 0) {
                            await prisma.inventoryMovement.create({
                                data: {
                                    inventoryItemId: existing.id,
                                    type: 'ENTRY',
                                    quantity: qty,
                                    userId,
                                    notes: 'Importación CSV'
                                }
                            });
                        }
                    } else {
                        const createdItem = await prisma.inventoryItem.create({
                            data: {
                                name,
                                category: row.categoria || row.category || 'OTHER',
                                quantity: qty,
                                minQuantity,
                                size: row.talla || row.size || null,
                                sku: row.sku || null,
                                brand: row.marca || row.brand || null,
                                unitPrice: row.precio || row.price ? Number(row.precio || row.price) : null,
                                supplier: row.proveedor || row.supplier || null,
                                warehouseLocation: row.ubicacion || row.location || null,
                                description: row.descripcion || row.description || null
                            }
                        });
                        if (qty > 0) {
                            await prisma.inventoryMovement.create({
                                data: {
                                    inventoryItemId: createdItem.id,
                                    type: 'ENTRY',
                                    quantity: qty,
                                    userId,
                                    notes: 'Stock inicial (importación CSV)'
                                }
                            });
                        }
                    }
                    results.created++;
                } catch (e) {
                    results.errors++;
                    results.errorDetails.push(`Fila ${i + 1}: ${(e as Error).message}`);
                }
            }

            fs.unlinkSync(req.file.path);
            return ApiResponse.success(res, results, `Importacion completada: ${results.created} creados, ${results.errors} errores`);
        } catch (error) {
            log.error({ error }, 'Error importing CSV');
            return ApiResponse.error(res, 'Error al importar CSV', 500);
        }
    }
};
