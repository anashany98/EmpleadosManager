import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';

/**
 * Returns the path to the company logo if it exists, otherwise null.
 */
export const getLogoPath = (): string | null => {
    const assetsPath = path.join(__dirname, '../../../assets/logo.png');
    return fs.existsSync(assetsPath) ? assetsPath : null;
};

/**
 * Embeds a QR code and metadata in the PDF
 */
export const addQRCodeToPDF = async (doc: typeof PDFDocument, data: any, employeeId: string) => {
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

/**
 * Finalizes a PDFDocument and returns its contents as a Buffer.
 */
export const buildPdfBuffer = (doc: any): Promise<Buffer> => new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.end();
    });

export const writeTemplateText = (doc: any, content: string) => {
    const lines = content.split(/\r?\n/);

    lines.forEach((line) => {
        const trimmed = line.trim();

        if (!trimmed) {
            doc.moveDown(0.7);
            return;
        }

        if (trimmed.startsWith('# ')) {
            doc.moveDown(0.4);
            doc.font('Helvetica-Bold').fontSize(16).text(trimmed.slice(2), { align: 'center' });
            doc.moveDown(0.8);
            return;
        }

        if (trimmed.startsWith('## ')) {
            doc.moveDown(0.3);
            doc.font('Helvetica-Bold').fontSize(12).text(trimmed.slice(3), { underline: true });
            doc.moveDown(0.4);
            return;
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            doc.font('Helvetica').fontSize(10).text(`• ${trimmed.slice(2)}`, { indent: 18, align: 'justify' });
            return;
        }

        doc.font('Helvetica').fontSize(10).text(trimmed, { align: 'justify' });
    });

    return doc;
};
