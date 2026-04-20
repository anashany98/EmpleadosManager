import PDFDocument from 'pdfkit';
import { prisma } from '../../lib/prisma';
import { StorageService } from '../StorageService';
import { InventoryService } from '../InventoryService';
import { getLogoPath, addQRCodeToPDF, buildPdfBuffer } from './DocumentPdfUtils';

export const generateUniform = async (employeeId: string, items?: Array<{ id?: string; name: string; size?: string }>, authorName?: string): Promise<any> => {
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

export const generateUniformInternal = async (employeeId: string, customItems?: Array<{ id?: string; name: string; size?: string }>, authorName?: string): Promise<any> => {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { company: true }
    });
    if (!employee) throw new Error('Empleado no encontrado');

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `Entrega_Uniforme_${employee.dni}_${Date.now()}.pdf`;

    await addQRCodeToPDF(doc, { t: 'UNIFORME' }, employeeId);
    const logoPath = getLogoPath();
    if (logoPath) doc.image(logoPath, 50, 40, { width: 100 });

    doc.y = logoPath ? 120 : 50;
    doc.fontSize(16).font('Helvetica-Bold').text('ACTA DE ENTREGA DE UNIFORME', { align: 'center' });
    doc.moveDown();

    // ... (Standard Header: Company/Employee)
    doc.fontSize(10).font('Helvetica-Bold').text('EMPRESA:');
    doc.font('Helvetica').text(`${employee.company?.name || 'N/A'} - CIF: ${employee.company?.cif || 'N/A'}`);
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('TRABAJADOR:');
    doc.font('Helvetica').text(`${employee.firstName} ${employee.lastName} - DNI: ${employee.dni}`);
    doc.moveDown();

    doc.text('Recibí de la empresa las siguientes prendas:', { align: 'justify' });
    doc.moveDown();

    const items = (customItems && customItems.length > 0) ? customItems : [];
    items.forEach(item => {
        const label = item.size ? `${item.name} (Talla: ${item.size})` : item.name;
        doc.text(`• ${label}`, { indent: 20 });
    });
    doc.moveDown();

    doc.fontSize(8).text('El trabajador se compromete a su uso obligado y conservación.', { align: 'justify' });

    // Signatures
    doc.moveDown(4);
    const startY = doc.y;
    const place = employee.company?.city || 'Palma';

    doc.text(`En ${place}, a ${new Date().toLocaleDateString('es-ES')}`);
    doc.moveDown();
    doc.text('Firma Empresa:', 50, doc.y);
    doc.text('Firma Trabajador:', 350, doc.y - 12);

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
