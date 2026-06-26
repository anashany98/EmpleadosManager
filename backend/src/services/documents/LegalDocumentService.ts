import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../lib/prisma';
import { EncryptionService } from '../EncryptionService';
import { StorageService } from '../StorageService';
import { getLogoPath, addQRCodeToPDF, buildPdfBuffer, writeTemplateText } from './DocumentPdfUtils';
import { CompanyDocumentTemplateService } from './DocumentTemplateService';
import { parseLayoutTemplate, renderLayoutTemplate } from './DocumentLayoutService';

export const generateNDA = async (employeeId: string, authorName?: string): Promise<any> => {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { company: true } });
    if (!employee) throw new Error('Empleado no encontrado');

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `NDA_${EncryptionService.decrypt(employee.dni) || 'unknown'}_${Date.now()}.pdf`;

    const logoPath = getLogoPath();
    const template = await CompanyDocumentTemplateService.getTemplate('NDA', employee.companyId);
    const context = await CompanyDocumentTemplateService.buildContext(employeeId, {
        includeVacations: true,
        authorName
    });
    const layout = parseLayoutTemplate(template?.content || '');

    if (layout) {
        await renderLayoutTemplate(doc, layout, context as Record<string, unknown>, {
            employeeId,
            documentType: 'NDA'
        });
    } else {
        await addQRCodeToPDF(doc, { t: 'NDA' }, employeeId);
        if (logoPath) doc.image(logoPath, 50, 40, { width: 100 });
        doc.y = logoPath ? 120 : 50;
        const rendered = CompanyDocumentTemplateService.renderTemplate(template?.content || '', context);
        writeTemplateText(doc, rendered);
        doc.moveDown(4);

        const startY = doc.y;
        doc.text('Firma Empresa:', 50, startY);
        doc.text('Firma Trabajador:', 350, startY);
    }

    const pdfBuffer = await buildPdfBuffer(doc);
    const { key } = await StorageService.saveBuffer({ folder: `documents/EXP_${employeeId}`, originalName: fileName, buffer: pdfBuffer, contentType: 'application/pdf' });

    try {
        return await prisma.document.create({ data: { name: 'Acuerdo Confidencialidad (NDA)', category: 'CONTRACT', fileUrl: key, employeeId } });
    } catch (dbError) {
        await StorageService.deleteFile(key).catch(() => {});
        throw dbError;
    }
};

export const generateRGPD = async (employeeId: string, authorName?: string): Promise<any> => {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { company: true } });
    if (!employee) throw new Error('Empleado no encontrado');

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `RGPD_${EncryptionService.decrypt(employee.dni) || 'unknown'}_${Date.now()}.pdf`;

    const logoPath = getLogoPath();
    const template = await CompanyDocumentTemplateService.getTemplate('RGPD', employee.companyId);
    const context = await CompanyDocumentTemplateService.buildContext(employeeId, {
        includeVacations: true,
        authorName
    });
    const layout = parseLayoutTemplate(template?.content || '');

    if (layout) {
        await renderLayoutTemplate(doc, layout, context as Record<string, unknown>, {
            employeeId,
            documentType: 'RGPD'
        });
    } else {
        await addQRCodeToPDF(doc, { t: 'RGPD' }, employeeId);
        if (logoPath) doc.image(logoPath, 50, 40, { width: 100 });
        doc.y = logoPath ? 120 : 50;
        const rendered = CompanyDocumentTemplateService.renderTemplate(template?.content || '', context);
        writeTemplateText(doc, rendered);
        doc.moveDown(2);

        const startY = doc.y;
        doc.text('Firma Trabajador:', 350, startY);
    }

    const pdfBuffer = await buildPdfBuffer(doc);
    const { key } = await StorageService.saveBuffer({ folder: `documents/EXP_${employeeId}`, originalName: fileName, buffer: pdfBuffer, contentType: 'application/pdf' });

    try {
        return await prisma.document.create({ data: { name: 'Cláusula RGPD', category: 'CONTRACT', fileUrl: key, employeeId } });
    } catch (dbError) {
        await StorageService.deleteFile(key).catch(() => {});
        throw dbError;
    }
};

export const generateModel145 = async (employeeId: string, authorName?: string): Promise<any> => {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { company: true }
    });

    if (!employee) throw new Error('Empleado no encontrado');

    const { PDFDocument: PDFLibDocument } = await import('pdf-lib');
    const templatePath = path.join(process.cwd(), 'src', 'templates', 'modelo145.pdf');

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
        if (dniField) dniField.setText(EncryptionService.decrypt(employee.dni) || '');

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
            form.getTextField('NIF_2')?.setText(EncryptionService.decrypt(employee.dni) || '');
            if (employee.birthDate) {
                form.getTextField('Año de nacimiento_2')?.setText(new Date(employee.birthDate).getFullYear().toString());
            }
            if (employee.company?.name) form.getTextField('La empresa o entidad_2')?.setText(employee.company.name);

            form.getTextField('En_2')?.setText(place);
            form.getTextField('día_2')?.setText(day);
            form.getTextField('de_3')?.setText(month); // Assuming de_3 follows de_2? Or maybe pattern differs.
            form.getTextField('de_4')?.setText(year);
        } catch { /* Ignore if fields don't exist */ }

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

    } catch (_) { console.warn('Error filling some fields:', _); }

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

    const fileName = `Modelo_145_${EncryptionService.decrypt(employee.dni) || 'unknown'}_${Date.now()}.pdf`;
    const { key } = await StorageService.saveBuffer({
        folder: `documents/EXP_${employeeId}`,
        originalName: fileName,
        buffer: Buffer.from(finalPdfBytes),
        contentType: 'application/pdf'
    });

    try {
        return await prisma.document.create({
            data: {
                name: 'Modelo 145 (Relleno)',
                category: 'CONTRACT',
                fileUrl: key,
                employeeId
            }
        });
    } catch (dbError) {
        await StorageService.deleteFile(key).catch(() => {});
        throw dbError;
    }
};
