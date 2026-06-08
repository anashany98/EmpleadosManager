import PDFDocument from 'pdfkit';
import { prisma } from '../../lib/prisma';
import { StorageService } from '../StorageService';
import { InventoryService } from '../InventoryService';
import { getLogoPath, addQRCodeToPDF, buildPdfBuffer, writeTemplateText } from './DocumentPdfUtils';
import { CompanyDocumentTemplateService } from './DocumentTemplateService';
import { parseLayoutTemplate, renderLayoutTemplate } from './DocumentLayoutService';

export const generateUniform = async (employeeId: string, items?: Array<{ id?: string; name: string; size?: string; quantity?: number }>, authorName?: string): Promise<any> => {
    const doc = await generateUniformInternal(employeeId, items, authorName);

    // --- INVENTORY AUTOMATION ---
    if (items && items.length > 0) {
        await Promise.all(items.map(async item => {
            try {
                if (item.id) {
                    // Precise deduction by ID with alerts
                    await InventoryService.recordMovement({
                        itemId: item.id,
                        type: 'ASSIGNMENT',
                        quantity: 1,
                        userId: authorName || 'SYSTEM',
                        employeeId,
                        notes: `Acta Uniforme: ${item.name} ${item.size ? `(${item.size})` : ''}`
                    });

                    await prisma.asset.create({
                        data: {
                            employeeId, category: 'UNIFORM', name: item.name, status: 'ASSIGNED',
                            inventoryItemId: item.id, assignedDate: new Date(),
                            notes: `Acta Uniforme: ${item.name} ${item.size ? `(${item.size})` : ''}`
                        }
                    });

                } else {
                    // Fallback by name (legacy)
                    const inv = await prisma.inventoryItem.findFirst({ where: { name: item.name.trim() } });
                    if (inv) {
                        await InventoryService.recordMovement({
                            itemId: inv.id,
                            type: 'ASSIGNMENT',
                            quantity: 1,
                            userId: authorName || 'SYSTEM',
                            employeeId,
                            notes: `Acta Uniforme (Legacy): ${item.name}`
                        });
                    }
                }
            } catch (err) { console.warn(`Stock error for ${item.name}`, err); }
        }));
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
    const fileName = `Entrega_Uniforme_${employee.dni}_${Date.now()}.pdf`;

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
                items: items
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

    return prisma.document.create({
        data: {
            name: 'Entrega Uniforme', category: 'OTHER', fileUrl: key, employeeId
        }
    });
};
