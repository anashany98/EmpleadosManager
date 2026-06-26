import fs from 'fs';
import path from 'path';
import { prisma } from '../../lib/prisma';
import { StorageService } from '../StorageService';

export const signDocument = async (documentId: string, signatureDataUrl: string): Promise<any> => {
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

    let signedDoc;
    try {
        signedDoc = await prisma.document.create({
            data: {
                employeeId: document.employeeId,
                name: `FIRMADO: ${document.name}`,
                category: document.category,
                fileUrl: key,
                expiryDate: document.expiryDate
            }
        });
    } catch (error) {
        await StorageService.deleteFile(key).catch(() => {});
        throw error;
    }

    return signedDoc;
};
