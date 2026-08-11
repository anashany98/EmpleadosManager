import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { createLogger } from '../../services/LoggerService';
import { buildSystemQrPayload } from './QrDocumentService';

const logger = createLogger('DocumentPdfUtils');

/**
 * Returns the path to the company logo if it exists, otherwise null.
 */
export const getLogoPath = (): string | null => {
    const assetsPath = path.join(process.cwd(), 'assets', 'logo.png');
    return fs.existsSync(assetsPath) ? assetsPath : null;
};

/**
 * Embeds a QR code and metadata in the PDF
 */
export const addQRCodeToPDF = async (doc: typeof PDFDocument, data: any, employeeId: string) => {
    try {
        const qrDataString = JSON.stringify(
            buildSystemQrPayload(employeeId, String(data?.t || 'DOCUMENT'), data)
        );

        // QR legible incluso tras imprimir + escanear + reenviar por email.
        //   - width 240 px (buffer grande) y 90 pt en el PDF (~32 mm),
        //     el triple que antes.
        //   - errorCorrectionLevel 'H' (recupera hasta el 30% del QR
        //     dañado por compresión JPEG/fax/impresión).
        //   - margin 4 (quiet zone generosa; jsQR falla con zonas
        //     blancas < 4 módulos).
        const qrBuffer = await QRCode.toBuffer(qrDataString, {
            errorCorrectionLevel: 'H',
            margin: 4,
            width: 240
        });

        // Add to PDF (bottom right). A4 = 595 x 842 pt.
        doc.image(qrBuffer, 460, 700, { width: 90 });

        // También grabamos el payload en los metadatos del PDF
        // para que jsQR no haga falta en documentos que no se
        // hayan vuelto a escanear.
        doc.info['Subject'] = qrDataString;
    } catch (err) {
        logger.error({ err }, 'Error adding QR code to PDF:');
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
