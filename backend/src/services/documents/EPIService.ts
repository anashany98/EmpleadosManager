import PDFDocument from 'pdfkit';
import { prisma } from '../../lib/prisma';
import { EncryptionService } from '../EncryptionService';
import { StorageService } from '../StorageService';
import { InventoryService } from '../InventoryService';
import { getLogoPath, addQRCodeToPDF, buildPdfBuffer, writeTemplateText } from './DocumentPdfUtils';
import { CompanyDocumentTemplateService } from './DocumentTemplateService';
import { parseLayoutTemplate, renderLayoutTemplate } from './DocumentLayoutService';
import { createLogger } from '../../services/LoggerService';

const logger = createLogger('EPIService');

export const generateEPI = async (employeeId: string, items?: Array<{ id?: string; name: string; size?: string; quantity?: number }>, authorName?: string): Promise<any> => {
    // --- PHASE 1: pre-validate stock for items with known IDs. Fail
    // fast (before generating the PDF) so we don't waste work and
    // don't leave orphan files when the operation can't succeed.
    const itemsWithId = (items || []).filter((it): it is { id: string; name: string; size?: string; quantity?: number } => Boolean(it.id));
    if (itemsWithId.length > 0) {
        await InventoryService.assertStockForItems(
            itemsWithId.map((it) => ({ itemId: it.id, quantity: Math.max(1, it.quantity ?? 1) }))
        );
    }

    // --- PHASE 2: generate the PDF + save to storage. `generateEPIInternal`
    // returns the persisted `Document` row (which has `fileUrl`).
    const doc = await generateEPIInternal(employeeId, items, authorName);

    // --- PHASE 3: atomic commit. Wrap the inventory movements and
    // the asset creations in a single transaction so the DB state
    // is always consistent: either the document exists AND the stock
    // is decremented AND the asset is tracked, or none of it.
    if (itemsWithId.length > 0) {
        try {
            await prisma.$transaction(async (tx) => {
                for (const item of itemsWithId) {
                    const qty = Math.max(1, item.quantity ?? 1);
                    await InventoryService.recordMovementInTx(tx, {
                        itemId: item.id,
                        type: 'ASSIGNMENT',
                        quantity: qty,
                        userId: authorName || 'SYSTEM',
                        employeeId,
                        notes: `Acta EPI: ${item.name} ${item.size ? `(${item.size})` : ''} x${qty}`
                    });
                    // Un Asset por unidad entregada: las devoluciones
                    // reponen exactamente 1 unidad por registro.
                    for (let i = 0; i < qty; i++) {
                        await tx.asset.create({
                            data: {
                                employeeId, category: 'EPI', name: item.name, status: 'ASSIGNED',
                                inventoryItemId: item.id, assignedDate: new Date(),
                                notes: `Acta EPI: ${item.name} ${item.size ? `(${item.size})` : ''}`
                            }
                        });
                    }
                }
            });
        } catch (err) {
            // Compensate: the transaction rolled back the document
            // row, but the PDF is still in storage. Delete the
            // orphan file. We do NOT swallow the error: the caller
            // must see INSUFFICIENT_STOCK (or whatever else went
            // wrong) so they can retry or correct the request.
            if (doc?.fileUrl) {
                await StorageService.deleteFile(doc.fileUrl).catch((delErr) => {
                    logger.warn({ err: delErr, fileUrl: doc.fileUrl }, 'Failed to delete orphan PDF after transaction rollback');
                });
            }
            // Also delete the document row (the transaction rolled
            // it back, but the `prisma.document.delete` is idempotent
            // — if it was already rolled back, this is a no-op).
            if (doc?.id) {
                await prisma.document.delete({ where: { id: doc.id } }).catch((delErr) => {
                    logger.warn({ err: delErr, docId: doc.id }, 'Failed to delete document row after transaction rollback');
                });
            }
            throw err;
        }
    } else if (items && items.length > 0) {
        // Legacy path: items without IDs (matched by name). Look up
        // and try to deduct, but tolerate the lookup miss (item not
        // catalogued) — this matches the original behavior for
        // legacy clients. The movement still goes through the
        // transactional path so the stock guard applies.
        for (const item of items) {
            const inv = await prisma.inventoryItem.findFirst({ where: { name: item.name.trim() } });
            if (!inv) continue;
            try {
                await prisma.$transaction(async (tx) => {
                    await InventoryService.recordMovementInTx(tx, {
                        itemId: inv.id,
                        type: 'ASSIGNMENT',
                        quantity: 1,
                        userId: authorName || 'SYSTEM',
                        employeeId,
                        notes: `Acta EPI (Legacy): ${item.name}`
                    });
                });
            } catch (err) {
                logger.warn({ err, itemName: item.name }, 'Legacy stock deduction failed; document already created');
            }
        }
    }
    return doc;
};

export const generateEPIInternal = async (employeeId: string, customItems?: Array<{ id?: string; name: string; size?: string; quantity?: number }>, authorName?: string): Promise<any> => {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { company: true }
    });
    if (!employee) throw new Error('Empleado no encontrado');

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `Entrega_EPIs_${EncryptionService.decrypt(employee.dni) || 'unknown'}_${Date.now()}.pdf`;

    const logoPath = getLogoPath();
    const items = (customItems && customItems.length > 0) ? customItems : [];
    const firstItem = items.length > 0 ? items[0] : null;
    const firstItemQty = firstItem?.quantity ?? 0;
    const listado = items.length > 0
        ? items.map((item) => {
            const sizeStr = item.size ? ` (Talla: ${item.size})` : '';
            const qtyStr = item.quantity && item.quantity > 1 ? ` [Cantidad: ${item.quantity}]` : '';
            return `- ${item.name}${sizeStr}${qtyStr}`;
        }).join('\n')
        : '- Sin articulos especificados';
    const template = await CompanyDocumentTemplateService.getTemplate('EPI', employee.companyId);
    const context = await CompanyDocumentTemplateService.buildContext(employeeId, {
        authorName,
        extraContext: {
            entrega: {
                listado,
                dispositivo: '',
                numeroSerie: '',
                talla: firstItem?.size || '',
                cantidad: firstItemQty > 1 ? String(firstItemQty) : '',
                items
            }
        }
    });
    const layout = parseLayoutTemplate(template?.content || '');

    if (layout) {
        await renderLayoutTemplate(doc, layout, context as Record<string, unknown>, {
            employeeId,
            documentType: 'EPI'
        });
    } else {
        await addQRCodeToPDF(doc, { t: 'EPI' }, employeeId);
        if (logoPath) doc.image(logoPath, 50, 40, { width: 100 });
        doc.y = logoPath ? 120 : 50;
        const rendered = CompanyDocumentTemplateService.renderTemplate(template?.content || '', context);
        writeTemplateText(doc, rendered);

        // Signatures
        doc.moveDown(4);
        const startY = doc.y;

        doc.text('Firma Empresa:', 50, startY);
        doc.text('Firma Trabajador:', 350, startY);
    }

    const pdfBuffer = await buildPdfBuffer(doc);
    const { key } = await StorageService.saveBuffer({ folder: `documents/EXP_${employeeId}`, originalName: fileName, buffer: pdfBuffer, contentType: 'application/pdf' });

    try {
        return await prisma.document.create({ data: { name: 'Entrega EPIs', category: 'PRL', fileUrl: key, employeeId } });
    } catch (error) {
        await StorageService.deleteFile(key).catch(() => {});
        throw error;
    }
};
