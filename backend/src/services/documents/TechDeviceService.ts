import PDFDocument from 'pdfkit';
import { prisma } from '../../lib/prisma';
import { StorageService } from '../StorageService';
import { InventoryService } from '../InventoryService';
import { getLogoPath, addQRCodeToPDF, buildPdfBuffer } from './DocumentPdfUtils';

export const generateTechDevice = async (employeeId: string, deviceName: string, serialNumber: string, authorName?: string, itemId?: string): Promise<any> => {
    const doc = await generateTechDeviceInternal(employeeId, deviceName, serialNumber, authorName);

    // --- INVENTORY AUTOMATION ---
    try {
        if (itemId) {
            await InventoryService.recordMovement({
                itemId: itemId,
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
    const fileName = `Entrega_Material_Tecnologico_${employee.dni}_${Date.now()}.pdf`;

    // QR Code
    await addQRCodeToPDF(doc, { t: 'TECH_DEVICE', name: deviceName, sn: serialNumber }, employeeId);

    const logoPath = getLogoPath();
    if (logoPath) doc.image(logoPath, 50, 40, { width: 100 });

    doc.y = logoPath ? 110 : 50;
    doc.fontSize(18).text('ACTA DE ENTREGA DE MATERIAL TECNOLÓGICO', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(12).font('Helvetica-Bold').text('DATOS DE LA EMPRESA:');
    doc.font('Helvetica').text(`Nombre: ${employee.company?.name || 'N/A'}`);
    doc.text(`CIF: ${employee.company?.cif || 'N/A'}`);
    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').text('DATOS DEL TRABAJADOR:');
    doc.font('Helvetica').text(`Nombre: ${employee.firstName} ${employee.lastName}`);
    doc.text(`DNI: ${employee.dni}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('MATERIAL ENTREGADO:');
    doc.font('Helvetica').text(`Dispositivo: ${deviceName}`);
    doc.text(`Número de Serie / IMEI: ${serialNumber}`);
    doc.moveDown(2);

    doc.font('Helvetica-Bold').text('CONDICIONES DE USO Y RESPONSABILIDAD:', { underline: true });
    doc.moveDown(0.5);
    doc.font('Helvetica').text('1. El trabajador recibe el material descrito en perfecto estado de funcionamiento y se compromete a utilizarlo exclusivamente para fines laborales.', { align: 'justify' });
    doc.moveDown(0.5);
    doc.text('2. El trabajador se hace responsable de la custodia del equipo. En caso de pérdida, rotura o robo por negligencia, el trabajador asumirá los costes de reparación o sustitución del dispositivo.', { align: 'justify' });
    doc.moveDown(0.5);
    doc.text('3. A la finalización de la relación laboral, el trabajador devolverá el equipo y sus accesorios en el mismo estado en que se le entregó, salvo el desgaste normal por el uso.', { align: 'justify' });

    const place = employee.company?.city || 'Palma de Mallorca';
    const author = authorName || employee.company?.legalRep || 'La Dirección';

    doc.moveDown(4);
    const startY = doc.y;
    doc.text('Recibí:', 50, startY);
    doc.text('Firma Trabajador', 50, startY + 15);
    doc.fontSize(8).text(author, 350, startY + 45); // Representative name

    doc.fontSize(12).text(`En ${place}, a ${new Date().toLocaleDateString('es-ES')}`, 50, startY + 80);

    const pdfBuffer = await buildPdfBuffer(doc);
    const { key } = await StorageService.saveBuffer({
        folder: `documents/EXP_${employeeId}`,
        originalName: fileName,
        buffer: pdfBuffer,
        contentType: 'application/pdf'
    });

    const docRecord = await prisma.document.create({
        data: {
            name: `Entrega ${deviceName}`,
            category: 'OTHER',
            fileUrl: key,
            employeeId: employeeId
        }
    });
    return docRecord;
};
