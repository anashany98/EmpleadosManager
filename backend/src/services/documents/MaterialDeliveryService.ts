import PDFDocument from 'pdfkit';
import { prisma } from '../../lib/prisma';
import { EncryptionService } from '../EncryptionService';
import { StorageService } from '../StorageService';
import { InventoryService } from '../InventoryService';
import { getLogoPath, addQRCodeToPDF, buildPdfBuffer, writeTemplateText } from './DocumentPdfUtils';
import { CompanyDocumentTemplateService } from './DocumentTemplateService';
import { parseLayoutTemplate, renderLayoutTemplate } from './DocumentLayoutService';
import { createLogger } from '../../services/LoggerService';

const logger = createLogger('MaterialDeliveryService');

export interface MaterialDeliveryItemInput {
    id?: string;
    name: string;
    quantity?: number;
    detail?: string;
}

const normalizeQuantity = (value?: number) => {
    if (!Number.isFinite(value) || Number(value) <= 0) {
        return 1;
    }

    return Math.max(1, Math.floor(Number(value)));
};

const normalizeItems = (items?: MaterialDeliveryItemInput[]) => (items || []).map((item) => ({
        id: item.id,
        name: item.name,
        quantity: normalizeQuantity(item.quantity),
        detail: item.detail?.trim() || ''
    }));

const formatMaterialLine = (item: ReturnType<typeof normalizeItems>[number]) => {
    const quantityPrefix = item.quantity > 1 ? `${item.quantity} x ` : '';
    const detailSuffix = item.detail ? ` (${item.detail})` : '';
    return `- ${quantityPrefix}${item.name}${detailSuffix}`;
};

export const generateMaterialDelivery = async (
    employeeId: string,
    items?: MaterialDeliveryItemInput[],
    authorName?: string
): Promise<any> => {
    const normalizedItems = normalizeItems(items);

    // --- PHASE 1: pre-validate stock for items with known IDs.
    const itemsWithId = normalizedItems.filter((it): it is { id: string; name: string; quantity: number; detail: string } => Boolean(it.id));
    if (itemsWithId.length > 0) {
        await InventoryService.assertStockForItems(
            itemsWithId.map((it) => ({ itemId: it.id, quantity: it.quantity }))
        );
    }

    // --- PHASE 2: generate PDF + save document.
    const doc = await generateMaterialDeliveryInternal(employeeId, normalizedItems, authorName);

    // --- PHASE 3: atomic commit (inventory movements in one tx).
    if (itemsWithId.length > 0) {
        try {
            await prisma.$transaction(async (tx) => {
                for (const item of itemsWithId) {
                    await InventoryService.recordMovementInTx(tx, {
                        itemId: item.id,
                        type: 'ASSIGNMENT',
                        quantity: item.quantity,
                        userId: authorName || 'SYSTEM',
                        employeeId,
                        notes: `Entrega material: ${item.name}${item.detail ? ` (${item.detail})` : ''}`
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
    } else if (normalizedItems.length > 0) {
        // Legacy fallback: items without IDs, matched by name.
        for (const item of normalizedItems) {
            const inventoryItem = await prisma.inventoryItem.findFirst({ where: { name: item.name.trim() } });
            if (!inventoryItem) continue;
            try {
                await prisma.$transaction(async (tx) => {
                    await InventoryService.recordMovementInTx(tx, {
                        itemId: inventoryItem.id,
                        type: 'ASSIGNMENT',
                        quantity: item.quantity,
                        userId: authorName || 'SYSTEM',
                        employeeId,
                        notes: `Entrega material (legacy): ${item.name}${item.detail ? ` (${item.detail})` : ''}`
                    });
                });
            } catch (err) {
                logger.warn({ err, itemName: item.name }, 'Legacy stock deduction failed; document already created');
            }
        }
    }

    return doc;
};

export const generateMaterialDeliveryInternal = async (
    employeeId: string,
    items?: MaterialDeliveryItemInput[],
    authorName?: string
): Promise<any> => {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { company: true }
    });

    if (!employee) throw new Error('Empleado no encontrado');

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `Entrega_Material_${EncryptionService.decrypt(employee.dni) || 'unknown'}_${Date.now()}.pdf`;
    const logoPath = getLogoPath();
    const normalizedItems = normalizeItems(items);
    const listado = normalizedItems.length > 0
        ? normalizedItems.map(formatMaterialLine).join('\n')
        : '- Sin articulos especificados';
    const template = await CompanyDocumentTemplateService.getTemplate('ENTREGA_MATERIAL', employee.companyId);
    const context = await CompanyDocumentTemplateService.buildContext(employeeId, {
        authorName,
        extraContext: {
            entrega: {
                listado,
                dispositivo: '',
                numeroSerie: '',
                items: normalizedItems
            }
        }
    });
    const layout = parseLayoutTemplate(template?.content || '');

    if (layout) {
        await renderLayoutTemplate(doc, layout, context as Record<string, unknown>, {
            employeeId,
            documentType: 'ENTREGA_MATERIAL'
        });
    } else {
        await addQRCodeToPDF(doc, { t: 'ENTREGA_MATERIAL' }, employeeId);
        if (logoPath) doc.image(logoPath, 50, 40, { width: 100 });
        doc.y = logoPath ? 120 : 50;
        const rendered = CompanyDocumentTemplateService.renderTemplate(template?.content || '', context);
        writeTemplateText(doc, rendered);

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
                name: 'Entrega Material',
                category: 'OTHER',
                fileUrl: key,
                employeeId
            }
        });
    } catch (error) {
        await StorageService.deleteFile(key).catch(() => {});
        throw error;
    }
};
