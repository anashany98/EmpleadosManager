import PDFDocument from 'pdfkit';
import { prisma } from '../../lib/prisma';
import { EncryptionService } from '../EncryptionService';
import { StorageService } from '../StorageService';
import { getLogoPath, addQRCodeToPDF, buildPdfBuffer } from './DocumentPdfUtils';

interface VacationDocumentData {
    employeeId: string;
    vacationId: string;
    startDate: Date;
    endDate: Date;
    days: number;
    type: string;
    reason?: string;
}

export const generateVacationDocument = async (data: VacationDocumentData): Promise<any> => {
    const employee = await prisma.employee.findUnique({
        where: { id: data.employeeId },
        include: { company: true }
    });

    if (!employee) throw new Error('Empleado no encontrado');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const fileName = `Vacaciones_${EncryptionService.decrypt(employee.dni) || 'unknown'}_${Date.now()}.pdf`;

    const logoPath = getLogoPath();
    if (logoPath) {
        doc.image(logoPath, 50, 40, { width: 100 });
    }

    const startY = logoPath ? 130 : 50;

    doc.font('Helvetica-Bold').fontSize(18).text('Solicitud de Vacaciones', 50, startY, { align: 'center' });
    doc.moveDown(1.5);

    doc.font('Helvetica').fontSize(11);
    doc.text(`Empleado: ${employee.firstName || ''} ${employee.lastName || employee.name}`, 50);
    doc.text(`DNI: ${EncryptionService.decrypt(employee.dni) || 'No disponible'}`);
    doc.text(`Departamento: ${employee.department || 'No asignado'}`);
    doc.text(`Puesto: ${employee.jobTitle || 'No asignado'}`);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').fontSize(12).text('Periodo de Vacaciones', 50);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11);
    doc.text(`Fecha de inicio: ${new Date(data.startDate).toLocaleDateString('es-ES')}`);
    doc.text(`Fecha de fin: ${new Date(data.endDate).toLocaleDateString('es-ES')}`);
    doc.text(`Días solicitados: ${data.days}`);
    doc.text(`Tipo: ${data.type === 'VACATION' ? 'Vacaciones' : data.type}`);
    if (data.reason) {
        doc.text(`Motivo: ${data.reason}`);
    }
    doc.moveDown(1.5);

    doc.font('Helvetica-Bold').fontSize(12).text('Firmas', 50);
    doc.moveDown(1);

    const firmY = doc.y;
    doc.font('Helvetica').fontSize(10);
    doc.text('Firma del Trabajador:', 50, firmY);
    doc.text('Firma del Responsable:', 350, firmY);

    doc.moveDown(2);
    doc.text('_'.repeat(30), 50, doc.y);
    doc.text('_'.repeat(30), 350, doc.y);

    doc.moveDown(1);
    doc.font('Helvetica').fontSize(9).fillColor('#666666');
    doc.text('Documento generado automáticamente. El código QR permite verificar la autenticidad del documento.', 50, doc.y, { align: 'center' });

    await addQRCodeToPDF(doc, { t: 'VACATION', vid: data.vacationId }, data.employeeId);

    const pdfBuffer = await buildPdfBuffer(doc);
    const { key } = await StorageService.saveBuffer({
        folder: `documents/EXP_${data.employeeId}`,
        originalName: fileName,
        buffer: pdfBuffer,
        contentType: 'application/pdf'
    });

    const document = await prisma.document.create({
        data: {
            name: `Solicitud Vacaciones ${new Date(data.startDate).toLocaleDateString('es-ES')} - ${new Date(data.endDate).toLocaleDateString('es-ES')}`,
            category: 'OTHER',
            fileUrl: key,
            employeeId: data.employeeId
        }
    });

    return document;
};
