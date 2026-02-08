import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma';
import { StorageService } from './StorageService';
import { InventoryService } from './InventoryService';

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
        doc.image(qrBuffer, 495, 720, { width: 50 });

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
    generateUniform: async (employeeId: string, items?: Array<{ id?: string; name: string; size?: string }>, authorName?: string): Promise<any> => {
        const doc = await DocumentTemplateService.generateUniformInternal(employeeId, items, authorName);

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
    },

    generateUniformInternal: async (employeeId: string, customItems?: Array<{ id?: string; name: string; size?: string }>, authorName?: string): Promise<any> => {
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
    },

    generateEPI: async (employeeId: string, items?: Array<{ id?: string; name: string; size?: string }>, authorName?: string): Promise<any> => {
        const doc = await DocumentTemplateService.generateEPIInternal(employeeId, items, authorName);

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
    },

    generateEPIInternal: async (employeeId: string, customItems?: Array<{ id?: string; name: string; size?: string }>, authorName?: string): Promise<any> => {
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
    },

    generateNDA: async (employeeId: string, authorName?: string): Promise<any> => {
        const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { company: true } });
        if (!employee) throw new Error('Empleado no encontrado');

        const doc = new PDFDocument({ margin: 50 });
        const fileName = `NDA_${employee.dni}_${Date.now()}.pdf`;
        await addQRCodeToPDF(doc, { t: 'NDA' }, employeeId);

        const logoPath = getLogoPath();
        if (logoPath) doc.image(logoPath, 50, 40, { width: 100 });

        doc.y = 120;
        doc.fontSize(16).font('Helvetica-Bold').text('ACUERDO DE CONFIDENCIALIDAD', { align: 'center' });
        doc.moveDown(2);

        doc.fontSize(10).font('Helvetica').text('REUNIDOS', { align: 'center', underline: true });
        doc.moveDown();
        doc.text(`De una parte, ${employee.company?.name || 'LA EMPRESA'}, con CIF ${employee.company?.cif || '...'}.`);
        doc.text(`De otra parte, D./Dña. ${employee.firstName} ${employee.lastName}, con DNI ${employee.dni} (en adelante, EL TRABAJADOR).`);
        doc.moveDown(2);

        doc.text('EXPONEN', { align: 'center', underline: true });
        doc.moveDown();
        doc.text('Que debido a la relación laboral, el Trabajador tendrá acceso a información confidencial de la Empresa (clientes, know-how, datos financieros, etc.).', { align: 'justify' });
        doc.moveDown();

        doc.text('CLÁUSULAS', { align: 'center', underline: true });
        doc.moveDown();
        doc.text('1. El Trabajador se compromete a guardar el más estricto secreto respecto a toda la información confidencial a la que tenga acceso.', { align: 'justify' });
        doc.moveDown();
        doc.text('2. La obligación de confidencialidad subsistirá incluso después de finalizar la relación laboral.', { align: 'justify' });
        doc.moveDown();
        doc.text('3. El incumplimiento de este deber podrá ser sancionado conforme al Estatuto de los Trabajadores.', { align: 'justify' });
        doc.moveDown(4);

        const startY = doc.y;
        doc.text('Firma Empresa:', 50, startY);
        doc.text('Firma Trabajador:', 350, startY);

        const pdfBuffer = await buildPdfBuffer(doc);
        const { key } = await StorageService.saveBuffer({ folder: `documents/EXP_${employeeId}`, originalName: fileName, buffer: pdfBuffer, contentType: 'application/pdf' });

        return prisma.document.create({ data: { name: 'Acuerdo Confidencialidad (NDA)', category: 'CONTRACT', fileUrl: key, employeeId } });
    },

    generateRGPD: async (employeeId: string, authorName?: string): Promise<any> => {
        const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { company: true } });
        if (!employee) throw new Error('Empleado no encontrado');

        const doc = new PDFDocument({ margin: 50 });
        const fileName = `RGPD_${employee.dni}_${Date.now()}.pdf`;
        await addQRCodeToPDF(doc, { t: 'RGPD' }, employeeId);

        const logoPath = getLogoPath();
        if (logoPath) doc.image(logoPath, 50, 40, { width: 100 });

        doc.y = 120;
        doc.fontSize(16).font('Helvetica-Bold').text('INFORMACIÓN SOBRE PROTECCIÓN DE DATOS', { align: 'center' });
        doc.moveDown(2);

        doc.fontSize(10).font('Helvetica').text('Responsable del Tratamiento:', { underline: true });
        doc.text(`${employee.company?.name || 'LA EMPRESA'} - CIF: ${employee.company?.cif || '...'}`);
        doc.moveDown();

        doc.text('Finalidad del Tratamiento:', { underline: true });
        doc.text('Gestión de la relación laboral, nóminas, prevención de riesgos y cumplimiento de obligaciones legales.', { align: 'justify' });
        doc.moveDown();

        doc.text('Legitimación:', { underline: true });
        doc.text('Ejecución del contrato de trabajo y cumplimiento de obligaciones legales.', { align: 'justify' });
        doc.moveDown();

        doc.text('Destinatarios:', { underline: true });
        doc.text('Administraciones públicas (Seguridad Social, Hacienda), bancos para el pago de nóminas y entidades colaboradoras (Mutuas).', { align: 'justify' });
        doc.moveDown();

        doc.text('Derechos:', { underline: true });
        doc.text('Puede ejercer sus derechos de acceso, rectificación, supresión y oposición dirigiéndose a la dirección de la empresa.', { align: 'justify' });
        doc.moveDown(3);

        doc.text('He leído y acepto el tratamiento de mis datos personales.', { align: 'center' });
        doc.moveDown(2);

        const startY = doc.y;
        doc.text('Firma Trabajador:', 350, startY);

        const pdfBuffer = await buildPdfBuffer(doc);
        const { key } = await StorageService.saveBuffer({ folder: `documents/EXP_${employeeId}`, originalName: fileName, buffer: pdfBuffer, contentType: 'application/pdf' });

        return prisma.document.create({ data: { name: 'Cláusula RGPD', category: 'CONTRACT', fileUrl: key, employeeId } });
    },

    generateModel145: async (employeeId: string, authorName?: string): Promise<any> => {
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
        const place = employee.company?.city || 'Palma de Mallorca';
        const author = authorName || employee.company?.legalRep || 'Matias Jure';

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
                page.drawText(author, {
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

    generateTechDevice: async (employeeId: string, deviceName: string, serialNumber: string, authorName?: string, itemId?: string): Promise<any> => {
        const doc = await DocumentTemplateService.generateTechDeviceInternal(employeeId, deviceName, serialNumber, authorName);

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
    },

    generateTechDeviceInternal: async (employeeId: string, deviceName: string, serialNumber: string, authorName?: string): Promise<any> => {
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
    },

    signDocument: async (documentId: string, signatureDataUrl: string): Promise<any> => {
        const document = await prisma.document.findUnique({
            where: { id: documentId },
            include: { employee: true }
        });

        if (!document) throw new Error('Documento no encontrado');

        const { PDFDocument: PDFLibDocument } = await import('pdf-lib');

        // Get file from storage
        let pdfBytes: Buffer;
        if (StorageService.provider === 'local') {
            const filePath = path.join(process.cwd(), 'uploads', document.fileUrl);
            pdfBytes = fs.readFileSync(filePath);
        } else {
            // S3 download logic would go here
            throw new Error('Digital signature only supported on local storage for now');
        }

        const pdfDoc = await PDFLibDocument.load(pdfBytes);
        const signatureImage = await pdfDoc.embedPng(signatureDataUrl);

        const pages = pdfDoc.getPages();
        const firstPage = pages[0]; // Usually sign on first page or we could logic it

        // Find signature placeholder or just draw at bottom
        // Standard position for our generated docs (approx)
        firstPage.drawImage(signatureImage, {
            x: 350,
            y: 80,
            width: 150,
            height: 50,
        });

        const finalPdfBytes = await pdfDoc.save();

        // Save as NEW document (avoid overwriting original for audit purposes)
        const fileName = `FIRMADO_${document.name.replace('.pdf', '')}_${Date.now()}.pdf`;
        const { key } = await StorageService.saveBuffer({
            folder: `documents/EXP_${document.employeeId}`,
            originalName: fileName,
            buffer: Buffer.from(finalPdfBytes),
            contentType: 'application/pdf'
        });

        const signedDoc = await prisma.document.create({
            data: {
                employeeId: document.employeeId,
                name: `FIRMADO: ${document.name}`,
                category: document.category,
                fileUrl: key,
                expiryDate: document.expiryDate
            }
        });

        return signedDoc;
    }
};
