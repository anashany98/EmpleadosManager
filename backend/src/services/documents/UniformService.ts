import PDFDocument from 'pdfkit';
import { prisma } from '../../lib/prisma';
import { EncryptionService } from '../EncryptionService';
import { StorageService } from '../StorageService';
import { InventoryService } from '../InventoryService';
import { getLogoPath, addQRCodeToPDF, buildPdfBuffer, writeTemplateText } from './DocumentPdfUtils';
import { CompanyDocumentTemplateService } from './DocumentTemplateService';
import { parseLayoutTemplate, renderLayoutTemplate } from './DocumentLayoutService';
import { createLogger } from '../../services/LoggerService';

const logger = createLogger('UniformService');

export const generateUniform = async (employeeId: string, items?: Array<{ id?: string; name: string; size?: string; quantity?: number }>, authorName?: string): Promise<any> => {
    // --- PHASE 1: pre-validate stock for items with known IDs.
    const itemsWithId = (items || []).filter((it): it is { id: string; name: string; size?: string; quantity?: number } => Boolean(it.id));
    if (itemsWithId.length > 0) {
        await InventoryService.assertStockForItems(
            itemsWithId.map((it) => ({ itemId: it.id, quantity: 1 }))
        );
    }

    // --- PHASE 2: generate the PDF + save to storage.
    const doc = await generateUniformInternal(employeeId, items, authorName);

    // --- PHASE 3: atomic commit (inventory + asset).
    if (itemsWithId.length > 0) {
        try {
            await prisma.$transaction(async (tx) => {
                for (const item of itemsWithId) {
                    await InventoryService.recordMovementInTx(tx, {
                        itemId: item.id,
                        type: 'ASSIGNMENT',
                        quantity: 1,
                        userId: authorName || 'SYSTEM',
                        employeeId,
                        notes: `Acta Uniforme: ${item.name} ${item.size ? `(${item.size})` : ''}`
                    });
                    await tx.asset.create({
                        data: {
                            employeeId, category: 'UNIFORM', name: item.name, status: 'ASSIGNED',
                            inventoryItemId: item.id, assignedDate: new Date(),
                            notes: `Acta Uniforme: ${item.name} ${item.size ? `(${item.size})` : ''}`
                        }
                    });
                }
            });
        } catch (err) {
            if (doc?.fileUrl) {
                await StorageService.deleteFile(doc.fileUrl).catch((delErr) => {
                    logger.warn({ err: delErr, fileUrl: doc.fileUrl }, 'Failed to delete orphan PDF after transaction rollback');
                });
            }
            if (doc?.id) {
                await prisma.document.delete({ where: { id: doc.id } }).catch((delErr) => {
                    logger.warn({ err: delErr, docId: doc.id }, 'Failed to delete document row after transaction rollback');
                });
            }
            throw err;
        }
    } else if (items && items.length > 0) {
        // Legacy fallback: items without IDs, matched by name.
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
                        notes: `Acta Uniforme (Legacy): ${item.name}`
                    });
                });
            } catch (err) {
                logger.warn({ err, itemName: item.name }, 'Legacy stock deduction failed; document already created');
            }
        }
    }
    return doc;
};

export const generateUniformInternal = async (employeeId: string, customItems?: Array<{ id?: string; name: string; size?: string; quantity?: number }>, authorName?: string): Promise<any> => {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { company: true }
    });
    if (!employee) throw new Error('Empleado no encontrado');

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `Entrega_Uniforme_${EncryptionService.decrypt(employee.dni) || 'unknown'}_${Date.now()}.pdf`;

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
    const template = await CompanyDocumentTemplateService.getTemplate('UNIFORM', employee.companyId);
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
            documentType: 'UNIFORME'
        });
    } else {
        await addQRCodeToPDF(doc, { t: 'UNIFORME' }, employeeId);
        if (logoPath) doc.image(logoPath, 50, 40, { width: 100 });
        doc.y = logoPath ? 120 : 50;
        const rendered = CompanyDocumentTemplateService.renderTemplate(template?.content || '', context);
        writeTemplateText(doc, rendered);

        // Signatures
        doc.moveDown(4);
        const place = employee.company?.city || 'Palma';

        doc.text(`En ${place}, a ${new Date().toLocaleDateString('es-ES')}`);
        doc.moveDown();
        doc.text('Firma Empresa:', 50, doc.y);
        doc.text('Firma Trabajador:', 350, doc.y - 12);
    }

    const pdfBuffer = await buildPdfBuffer(doc);
    const { key } = await StorageService.saveBuffer({
        folder: `documents/EXP_${employeeId}`,
        originalName: fileName,
        buffer: pdfBuffer,
        contentType: 'application/pdf'
    });

    try {
        return await prisma.document.create({
            data: {
                name: 'Entrega Uniforme', category: 'OTHER', fileUrl: key, employeeId
            }
        });
    } catch (error) {
        await StorageService.deleteFile(key).catch(() => {});
        throw error;
    }
};
