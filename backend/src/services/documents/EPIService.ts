import PDFDocument from 'pdfkit';
import { prisma } from '../../lib/prisma';
import { EncryptionService } from '../EncryptionService';
import { StorageService } from '../StorageService';
import { InventoryService } from '../InventoryService';
import { getLogoPath, addQRCodeToPDF, buildPdfBuffer, writeTemplateText } from './DocumentPdfUtils';
import { CompanyDocumentTemplateService } from './DocumentTemplateService';
import { parseLayoutTemplate, renderLayoutTemplate } from './DocumentLayoutService';

export const generateEPI = async (employeeId: string, items?: Array<{ id?: string; name: string; size?: string; quantity?: number }>, authorName?: string): Promise<any> => {
    const doc = await generateEPIInternal(employeeId, items, authorName);

    // --- INVENTORY AUTOMATION ---
    if (items && items.length > 0) {
        await Promise.all(items.map(async item => {
            try {
                if (item.id) {
                    await InventoryService.recordMovement({
                        itemId: item.id,
                        type: 'ASSIGNMENT',
                        quantity: 1,
                        userId: authorName || 'SYSTEM',
                        employeeId,
                        notes: `Acta EPI: ${item.name} ${item.size ? `(${item.size})` : ''}`
                    });

                    await prisma.asset.create({
                        data: {
                            employeeId, category: 'EPI', name: item.name, status: 'ASSIGNED',
                            inventoryItemId: item.id, assignedDate: new Date(),
                            notes: `Acta EPI: ${item.name} ${item.size ? `(${item.size})` : ''}`
                        }
                    });
                } else {
                    // Fallback
                    const inv = await prisma.inventoryItem.findFirst({ where: { name: item.name.trim() } });
                    if (inv) {
                        await InventoryService.recordMovement({
                            itemId: inv.id,
                            type: 'ASSIGNMENT',
                            quantity: 1,
                            userId: authorName || 'SYSTEM',
                            employeeId,
                            notes: `Acta EPI (Legacy): ${item.name}`
                        });
                    }
                }
            } catch (err) { console.warn(`Stock error for ${item.name}`, err); }
        }));
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

    return prisma.document.create({ data: { name: 'Entrega EPIs', category: 'PRL', fileUrl: key, employeeId } });
};
