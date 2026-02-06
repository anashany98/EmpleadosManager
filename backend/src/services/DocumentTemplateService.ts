import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma';
import { StorageService } from './StorageService';

const getLogoPath = () => {
    const assetsPath = path.join(__dirname, '../../assets/logo.png');
    return fs.existsSync(assetsPath) ? assetsPath : null;
};

/**
 * Embeds a QR code and metadata in the PDF
 */
const addQRCodeToPDF = async (doc: typeof PDFDocument, data: any, employeeId: string) => {
    try {
        const qrDataString = JSON.stringify({
            ...data,
            eid: employeeId,
            d: new Date().toISOString()
        });

        // Generate QR as buffer
        const qrBuffer = await QRCode.toBuffer(qrDataString, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 100
        });

        // Add to PDF (bottom right)
        // A4 is roughly 595 x 842 points
        doc.image(qrBuffer, 470, 720, { width: 75 });

        // Add metadata for backend parsing (pdfkit doesn't support setting subject directly easily, 
        // but we can add it to information dictionary if needed or just rely on image for now.
        // Actually, we'll try to set the 'Subject' info field.
        doc.info['Subject'] = qrDataString;
    } catch (err) {
        console.error('Error adding QR code to PDF:', err);
    }
};

const buildPdfBuffer = (doc: any): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.end();
    });
};

export const DocumentTemplateService = {
    generateUniform: async (employeeId: string, customItems?: Array<{ name: string; size?: string }>): Promise<any> => {
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: { company: true }
        });

        if (!employee) throw new Error('Empleado no encontrado');

        const doc = await DocumentTemplateService.generateUniformInternal(employeeId, customItems);
        const items = (customItems && customItems.length > 0) ? customItems : [];

        // --- INVENTORY AUTOMATION ---
        const assetPromises = items.map(async item => {
            const itemName = item.name.trim();
            try {
                const inventoryItem = await prisma.inventoryItem.findFirst({ where: { name: itemName } });
                if (inventoryItem) {
                    await prisma.inventoryItem.update({
                        where: { id: inventoryItem.id },
                        data: { quantity: { decrement: 1 } }
                    });
                }
            } catch (err) { console.warn(`Could not deduct stock for ${itemName}`, err); }

            return prisma.asset.create({
                data: {
                    employeeId: employeeId,
                    category: 'UNIFORM',
                    name: itemName,
                    status: 'ASSIGNED',
                    assignedDate: new Date(),
                    notes: `Generado automáticamente al crear Acta de Entrega Uniforme${item.size ? ` (Talla: ${item.size})` : ''}`
                }
            });
        });

        await Promise.all(assetPromises);
        return doc;

    },

    generateUniformInternal: async (employeeId: string, customItems?: Array<{ name: string; size?: string }>): Promise<any> => {
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: { company: true }
        });

        if (!employee) throw new Error('Empleado no encontrado');

        const doc = new PDFDocument({ margin: 50 });
        const fileName = `Entrega_Uniforme_${employee.dni}_${Date.now()}.pdf`;

        // QR Code
        await addQRCodeToPDF(doc, { t: 'UNIFORME' }, employeeId);

        const logoPath = getLogoPath();
        let headerOffset = 0;
        if (logoPath) {
            doc.image(logoPath, 50, 40, { width: 100 });
            headerOffset = 60;
        }

        doc.y = 50 + headerOffset;
        doc.fontSize(20).text('ACTA DE ENTREGA DE UNIFORME Y ROPA DE TRABAJO', { align: 'center' });
        doc.moveDown();

        doc.fontSize(12).font('Helvetica-Bold').text('DATOS DE LA EMPRESA:');
        doc.font('Helvetica').text(`Nombre: ${employee.company?.name || 'N/A'}`);
        doc.text(`CIF: ${employee.company?.cif || 'N/A'}`);
        doc.moveDown();

        doc.font('Helvetica-Bold').text('DATOS DEL TRABAJADOR:');
        doc.font('Helvetica-Bold').text(`Nombre: ${employee.firstName} ${employee.lastName}`);
        doc.font('Helvetica').text(`DNI: ${employee.dni}`);
        doc.text(`Puesto: ${employee.jobTitle || 'N/A'}`);
        doc.moveDown();

        doc.font('Helvetica').text('D./Dña. declara haber recibido por parte de la empresa las siguientes prendas de uniforme y ropa de trabajo:', { align: 'justify' });
        doc.moveDown();

        const items = (customItems && customItems.length > 0) ? customItems : [];
        items.forEach(item => {
            const label = item.size ? `${item.name} (Talla: ${item.size})` : item.name;
            doc.text(`- ${label}`);
        });
        doc.moveDown();

        doc.text('El trabajador se compromete a la correcta conservación y limpieza de las prendas entregadas, debiendo devolverlas en caso de cese de la relación laboral.', { align: 'justify' });
        doc.moveDown(2);

        const startY = doc.y;
        doc.text('Firma Empresa:', 50, startY);
        doc.text('Firma Trabajador:', 350, startY);
        doc.moveDown(4);
        doc.text(`En Palma de Mallorca, a ${new Date().toLocaleDateString('es-ES')}`, { align: 'left' });

        const pdfBuffer = await buildPdfBuffer(doc);
        const { key } = await StorageService.saveBuffer({
            folder: `documents/EXP_${employeeId}`,
            originalName: fileName,
            buffer: pdfBuffer,
            contentType: 'application/pdf'
        });

        const docRecord = await prisma.document.create({
            data: {
                name: 'Entrega Uniforme (Generado)',
                category: 'OTHER',
                fileUrl: key,
                employeeId: employeeId
            }
        });
        return docRecord;
    },
    generateEPI: async (employeeId: string, customItems?: Array<{ name: string; size?: string }>): Promise<any> => {
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: { company: true }
        });

        if (!employee) throw new Error('Empleado no encontrado');

        const doc = await DocumentTemplateService.generateEPIInternal(employeeId, customItems);
        const items = (customItems && customItems.length > 0) ? customItems : [];

        // --- INVENTORY AUTOMATION ---
        const assetPromises = items.map(async item => {
            const itemName = item.name.trim();
            try {
                const inventoryItem = await prisma.inventoryItem.findFirst({ where: { name: itemName } });
                if (inventoryItem) {
                    await prisma.inventoryItem.update({
                        where: { id: inventoryItem.id },
                        data: { quantity: { decrement: 1 } }
                    });
                }
            } catch (err) { console.warn(`Could not deduct stock for ${itemName}`, err); }

            return prisma.asset.create({
                data: {
                    employeeId: employeeId,
                    category: 'EPI',
                    name: itemName,
                    status: 'ASSIGNED',
                    assignedDate: new Date(),
                    notes: `Generado automáticamente al crear Acta de Entrega EPI${item.size ? ` (Talla: ${item.size})` : ''}`
                }
            });
        });

        await Promise.all(assetPromises);
        return doc;
    },

    generateEPIInternal: async (employeeId: string, customItems?: Array<{ name: string; size?: string }>): Promise<any> => {
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: { company: true }
        });

        if (!employee) throw new Error('Empleado no encontrado');

        const doc = new PDFDocument({ margin: 50 });
        const fileName = `Entrega_EPIs_${employee.dni}_${Date.now()}.pdf`;

        // QR Code
        await addQRCodeToPDF(doc, { t: 'EPI' }, employeeId);

        const logoPath = getLogoPath();
        let headerOffset = 0;
        if (logoPath) {
            doc.image(logoPath, 50, 40, { width: 100 });
            headerOffset = 60;
        }

        doc.y = 50 + headerOffset;
        doc.fontSize(20).text('ACTA DE ENTREGA DE EQUIPOS DE PROTECCIÓN INDIVIDUAL (EPI)', { align: 'center' });
        doc.moveDown();

        doc.fontSize(12).font('Helvetica-Bold').text('DATOS DE LA EMPRESA:');
        doc.font('Helvetica').text(`Nombre: ${employee.company?.name || 'N/A'}`);
        doc.text(`CIF: ${employee.company?.cif || 'N/A'}`);
        doc.moveDown();

        doc.font('Helvetica-Bold').text('DATOS DEL TRABAJADOR:');
        doc.font('Helvetica-Bold').text(`Nombre: ${employee.firstName} ${employee.lastName}`);
        doc.font('Helvetica').text(`DNI: ${employee.dni}`);
        doc.text(`Puesto: ${employee.jobTitle || 'N/A'}`);
        doc.moveDown();

        doc.font('Helvetica').text('D./Dña. declara haber recibido por parte de la empresa los siguientes Equipos de Protección Individual, así como la información sobre su uso y mantenimiento:', { align: 'justify' });
        doc.moveDown();

        const items = (customItems && customItems.length > 0) ? customItems : [];
        items.forEach(item => {
            const label = item.size ? `${item.name} (Talla: ${item.size})` : item.name;
            doc.text(`- ${label}`);
        });
        doc.moveDown();

        doc.text('El trabajador se compromete a utilizar y cuidar correctamente los equipos entregados, informando a su superior de cualquier defecto o pérdida de los mismos.', { align: 'justify' });
        doc.moveDown(2);

        const startY = doc.y;
        doc.text('Firma Empresa:', 50, startY);
        doc.text('Firma Trabajador:', 350, startY);
        doc.moveDown(4);
        doc.text(`En Palma de Mallorca, a ${new Date().toLocaleDateString('es-ES')}`, { align: 'left' });

        const pdfBuffer = await buildPdfBuffer(doc);
        const { key } = await StorageService.saveBuffer({
            folder: `documents/EXP_${employeeId}`,
            originalName: fileName,
            buffer: pdfBuffer,
            contentType: 'application/pdf'
        });

        const docRecord = await prisma.document.create({
            data: {
                name: 'Entrega EPIs (Generado)',
                category: 'PRL',
                fileUrl: key,
                employeeId: employeeId
            }
        });
        return docRecord;
    },

    generateModel145: async (employeeId: string): Promise<any> => {
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: { company: true }
        });

        if (!employee) throw new Error('Empleado no encontrado');

        const { PDFDocument: PDFLibDocument } = await import('pdf-lib');
        const templatePath = path.join(__dirname, '../templates/modelo145.pdf');

        if (!fs.existsSync(templatePath)) throw new Error('Plantilla Modelo 145 no encontrada');

        const existingPdfBytes = fs.readFileSync(templatePath);
        const pdfDoc = await PDFLibDocument.load(existingPdfBytes);
        const form = pdfDoc.getForm();

        const today = new Date();
        const day = today.getDate().toString().padStart(2, '0');
        const month = today.toLocaleString('es-ES', { month: 'long' });
        const year = today.getFullYear().toString();
        const place = 'Palma de Mallorca';

        try {
            const nameField = form.getTextField('Apellidos y Nombre');
            if (nameField) nameField.setText(`${employee.lastName}, ${employee.firstName}`);

            const dniField = form.getTextField('NIF');
            if (dniField) dniField.setText(employee.dni || '');

            const birthYearField = form.getTextField('Año de nacimiento');
            if (birthYearField && employee.birthDate) {
                const bYear = new Date(employee.birthDate).getFullYear().toString();
                birthYearField.setText(bYear);
            }

            const companyField = form.getTextField('La empresa o entidad');
            if (companyField && employee.company?.name) companyField.setText(employee.company.name);

            form.getTextField('En')?.setText(place);
            form.getTextField('día')?.setText(day);
            form.getTextField('de')?.setText(month);
            form.getTextField('de_2')?.setText(year);

            // Attempt to fill Page 2 (Copy) fields if they follow the standard duplicate naming convention (often _1, _2 or similar)
            // We try both _2 and just generic filling incase they are linked, but user says they are empty.
            try {
                // Copy Fields
                form.getTextField('Apellidos y Nombre_2')?.setText(`${employee.lastName}, ${employee.firstName}`);
                form.getTextField('NIF_2')?.setText(employee.dni || '');
                if (employee.birthDate) {
                    form.getTextField('Año de nacimiento_2')?.setText(new Date(employee.birthDate).getFullYear().toString());
                }
                if (employee.company?.name) form.getTextField('La empresa o entidad_2')?.setText(employee.company.name);

                form.getTextField('En_2')?.setText(place);
                form.getTextField('día_2')?.setText(day);
                form.getTextField('de_3')?.setText(month); // Assuming de_3 follows de_2? Or maybe pattern differs.
                form.getTextField('de_4')?.setText(year);
            } catch (e) { /* Ignore if fields don't exist */ }

            form.flatten();

            // Manually draw text for "Acuse de Recibo" on ALL pages (Original and Copy)
            const pages = pdfDoc.getPages();

            pages.forEach(page => {
                // Signature line - Adjusted lower and checks removed "Fdo:" prefix
                // User requested to remove the date drawing on the left as it overlaps.
                page.drawText('Matias Jure', {
                    x: 350,
                    y: 75,
                    size: 10,
                });
            });

        } catch (e) { console.warn('Error filling some fields:', e); }

        const pdfBytes = await pdfDoc.save();

        // Metadata (Subject) for auto-assignment
        const qrDataString = JSON.stringify({
            t: 'MODEL_145',
            eid: employeeId,
            d: new Date().toISOString()
        });

        const pdfDocWithMeta = await PDFLibDocument.load(pdfBytes);
        pdfDocWithMeta.setSubject(qrDataString);

        const finalPdfBytes = await pdfDocWithMeta.save();

        const fileName = `Modelo_145_${employee.dni}_${Date.now()}.pdf`;
        const { key } = await StorageService.saveBuffer({
            folder: `documents/EXP_${employeeId}`,
            originalName: fileName,
            buffer: Buffer.from(finalPdfBytes),
            contentType: 'application/pdf'
        });

        const doc = await prisma.document.create({
            data: {
                name: 'Modelo 145 (Relleno)',
                category: 'CONTRACT',
                fileUrl: key,
                employeeId: employeeId
            }
        });

        return doc;
    },

    generateTechDevice: async (employeeId: string, deviceName: string, serialNumber: string): Promise<any> => {
        const doc = await DocumentTemplateService.generateTechDeviceInternal(employeeId, deviceName, serialNumber);

        // --- INVENTORY AUTOMATION ---
        try {
            const inventoryItem = await prisma.inventoryItem.findFirst({ where: { name: deviceName } });
            if (inventoryItem) {
                await prisma.inventoryItem.update({
                    where: { id: inventoryItem.id },
                    data: { quantity: { decrement: 1 } }
                });
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
                    assignedDate: new Date(),
                    notes: 'Generado automáticamente al crear Acta de Entrega Material Tecnológico'
                }
            });
        } catch (err) { console.error('Error creating asset for Tech Device:', err); }

        return doc;
    },

    generateTechDeviceInternal: async (employeeId: string, deviceName: string, serialNumber: string): Promise<any> => {
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

        doc.moveDown(4);
        const startY = doc.y;
        doc.text('Recibí:', 50, startY);
        doc.text('Firma Trabajador', 50, startY + 15);
        doc.text(`En Palma de Mallorca, a ${new Date().toLocaleDateString('es-ES')}`, 50, startY + 80);

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
    }
};
