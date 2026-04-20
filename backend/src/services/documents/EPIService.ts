import PDFDocument from 'pdfkit';
import { prisma } from '../../lib/prisma';
import { StorageService } from '../StorageService';
import { InventoryService } from '../InventoryService';
import { getLogoPath, addQRCodeToPDF, buildPdfBuffer } from './DocumentPdfUtils';

export const generateEPI = async (employeeId: string, items?: Array<{ id?: string; name: string; size?: string }>, authorName?: string): Promise<any> => {
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

export const generateEPIInternal = async (employeeId: string, customItems?: Array<{ id?: string; name: string; size?: string }>, authorName?: string): Promise<any> => {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { company: true }
    });
    if (!employee) throw new Error('Empleado no encontrado');

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `Entrega_EPIs_${employee.dni}_${Date.now()}.pdf`;

    await addQRCodeToPDF(doc, { t: 'EPI' }, employeeId);
    const logoPath = getLogoPath();
    if (logoPath) doc.image(logoPath, 50, 40, { width: 100 });

    doc.y = logoPath ? 120 : 50;
    doc.fontSize(16).font('Helvetica-Bold').text('ACTA DE ENTREGA DE EPIS', { align: 'center' });
    doc.moveDown();

    doc.fontSize(10).font('Helvetica-Bold').text('EMPRESA:');
    doc.font('Helvetica').text(`${employee.company?.name || 'N/A'}`);
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('TRABAJADOR:');
    doc.font('Helvetica').text(`${employee.firstName} ${employee.lastName} - DNI: ${employee.dni}`);
    doc.moveDown();

    doc.text('He recibido los siguientes Equipos de Protección Individual y he sido informado sobre su uso:', { align: 'justify' });
    doc.moveDown();

    const items = (customItems && customItems.length > 0) ? customItems : [];
    items.forEach(item => {
        doc.text(`• ${item.name} ${item.size ? `(${item.size})` : ''}`, { indent: 20 });
    });
    doc.moveDown();

    // Signatures
    doc.moveDown(4);
    const startY = doc.y;

    doc.text('Firma Empresa:', 50, startY);
    doc.text('Firma Trabajador:', 350, startY);

    const pdfBuffer = await buildPdfBuffer(doc);
    const { key } = await StorageService.saveBuffer({ folder: `documents/EXP_${employeeId}`, originalName: fileName, buffer: pdfBuffer, contentType: 'application/pdf' });

    return prisma.document.create({ data: { name: 'Entrega EPIs', category: 'PRL', fileUrl: key, employeeId } });
};
