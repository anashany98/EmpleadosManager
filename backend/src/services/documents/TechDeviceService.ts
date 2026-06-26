import PDFDocument from 'pdfkit';
import { prisma } from '../../lib/prisma';
import { EncryptionService } from '../EncryptionService';
import { StorageService } from '../StorageService';
import { InventoryService } from '../InventoryService';
import { getLogoPath, addQRCodeToPDF, buildPdfBuffer, writeTemplateText } from './DocumentPdfUtils';
import { CompanyDocumentTemplateService } from './DocumentTemplateService';
import { parseLayoutTemplate, renderLayoutTemplate } from './DocumentLayoutService';

export const generateTechDevice = async (employeeId: string, deviceName: string, serialNumber: string, authorName?: string, itemId?: string): Promise<any> => {
    const doc = await generateTechDeviceInternal(employeeId, deviceName, serialNumber, authorName);

    // --- INVENTORY AUTOMATION ---
    try {
        if (itemId) {
            await InventoryService.recordMovement({
                itemId,
                type: 'ASSIGNMENT',
                quantity: 1,
                userId: authorName || 'SYSTEM',
                employeeId,
                notes: `Acta Material Tecnológico: ${deviceName}`
            });
        } else {
            const inventoryItem = await prisma.inventoryItem.findFirst({ where: { name: deviceName } });
            if (inventoryItem) {
                await InventoryService.recordMovement({
                    itemId: inventoryItem.id,
                    type: 'ASSIGNMENT',
                    quantity: 1,
                    userId: authorName || 'SYSTEM',
                    employeeId,
                    notes: `Acta Material Tecnológico (Legacy): ${deviceName}`
                });
            }
        }
    } catch (err) { console.warn('Could not deduct stock for Tech Device:', err); }

    try {
        await prisma.asset.create({
            data: {
                employeeId,
                category: 'TECH',
                name: deviceName,
                serialNumber,
                status: 'ASSIGNED',
                inventoryItemId: itemId || null,
                assignedDate: new Date(),
                notes: 'Generado automáticamente al crear Acta de Entrega Material Tecnológico'
            }
        });
    } catch (err) { console.error('Error creating asset for Tech Device:', err); }

    return doc;
};

export const generateTechDeviceInternal = async (employeeId: string, deviceName: string, serialNumber: string, authorName?: string): Promise<any> => {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { company: true }
    });

    if (!employee) throw new Error('Empleado no encontrado');

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `Entrega_Material_Tecnologico_${EncryptionService.decrypt(employee.dni) || 'unknown'}_${Date.now()}.pdf`;

    const logoPath = getLogoPath();
    const template = await CompanyDocumentTemplateService.getTemplate('TECH_DEVICE', employee.companyId);
    const context = await CompanyDocumentTemplateService.buildContext(employeeId, {
        authorName,
        extraContext: {
            entrega: {
                listado: `- ${deviceName}`,
                dispositivo: deviceName,
                numeroSerie: serialNumber || 'Sin numero de serie'
            }
        }
    });
    const layout = parseLayoutTemplate(template?.content || '');

    if (layout) {
        await renderLayoutTemplate(doc, layout, context as Record<string, unknown>, {
            employeeId,
            documentType: 'TECH_DEVICE',
            qrData: { name: deviceName, sn: serialNumber }
        });
    } else {
        await addQRCodeToPDF(doc, { t: 'TECH_DEVICE', name: deviceName, sn: serialNumber }, employeeId);
        if (logoPath) doc.image(logoPath, 50, 40, { width: 100 });
        doc.y = logoPath ? 110 : 50;
        const rendered = CompanyDocumentTemplateService.renderTemplate(template?.content || '', context);
        writeTemplateText(doc, rendered);

        const place = employee.company?.city || 'Palma de Mallorca';
        const author = authorName || employee.company?.legalRep || 'La Direccion';

        doc.moveDown(4);
        const startY = doc.y;
        doc.text('Recibi:', 50, startY);
        doc.text('Firma Trabajador', 50, startY + 15);
        doc.fontSize(8).text(author, 350, startY + 45);

        doc.fontSize(12).text(`En ${place}, a ${new Date().toLocaleDateString('es-ES')}`, 50, startY + 80);
    }

    const pdfBuffer = await buildPdfBuffer(doc);
    const { key } = await StorageService.saveBuffer({
        folder: `documents/EXP_${employeeId}`,
        originalName: fileName,
        buffer: pdfBuffer,
        contentType: 'application/pdf'
    });

    try {
        const docRecord = await prisma.document.create({
            data: {
                name: `Entrega ${deviceName}`,
                category: 'OTHER',
                fileUrl: key,
                employeeId
            }
        });
        return docRecord;
    } catch (error) {
        await StorageService.deleteFile(key).catch(() => {});
        throw error;
    }
};
