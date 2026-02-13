import { Job } from 'bullmq';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { StorageService } from '../services/StorageService';
import { NotificationService } from '../services/NotificationService';
import { createLogger } from '../services/LoggerService';
import { inboxService } from '../services/InboxService';
import jsQR from 'jsqr';
import { PDFDocument } from 'pdf-lib';
import { createWorker } from 'tesseract.js';

const log = createLogger('FileProcessor');

export const FileProcessor = async (job: Job) => {
    const { filePath } = job.data;
    const filename = path.basename(filePath);

    log.info({ jobId: job.id, filename }, 'Processing file job started');

    try {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        // Check if already in DB (Double check, though queue handles concurrency better)
        const existing = await prisma.inboxDocument.findFirst({
            where: { filename: filename }
        });

        if (existing) {
            log.info({ filename }, 'File already processed/in DB, skipping');
            return; // Done
        }

        const ext = path.extname(filename);
        const buffer = fs.readFileSync(filePath);
        let qrData = null;

        // 1. Analyze File (OCR/Metadata)
        if (ext.toLowerCase() === '.pdf') {
            try {
                const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
                const subject = pdfDoc.getSubject();
                if (subject) {
                    try {
                        const parsed = JSON.parse(subject);
                        if (parsed.eid && parsed.t) {
                            qrData = parsed;
                            log.info({ type: qrData.t }, 'Found system metadata in PDF Subject');
                        }
                    } catch (e) { }
                }
            } catch (e) {
                log.warn({ error: e }, 'Error reading PDF metadata');
            }
        } else if (['.png', '.jpg', '.jpeg'].includes(ext.toLowerCase())) {
            qrData = await scanImageForQR(buffer);
        }

        // 1.5. OCR Extraction (Text)
        let extractedText = '';
        try {
            if (['.png', '.jpg', '.jpeg'].includes(ext.toLowerCase())) {
                const worker = await createWorker('spa');
                const { data: { text } } = await worker.recognize(buffer);
                await worker.terminate();
                extractedText = text;
                log.info({ filename }, 'OCR Completed');
            }
            // TODO: Add PDF OCR support (requires pdf-to-image or similar, complex in Node pure)
            // For now, we only support Image OCR.
        } catch (ocrError) {
            log.error({ filename, error: ocrError }, 'OCR Failed');
        }

        // 2. Upload to Storage
        const lowerExt = ext.toLowerCase();
        const contentType = lowerExt === '.pdf'
            ? 'application/pdf'
            : (['.png', '.jpg', '.jpeg'].includes(lowerExt)
                ? (lowerExt === '.png' ? 'image/png' : 'image/jpeg')
                : undefined);

        const { key } = await StorageService.saveBuffer({
            folder: 'inbox',
            originalName: filename,
            buffer,
            contentType
        });

        // 3. Create Inbox Entry
        const inboxDoc = await prisma.inboxDocument.create({
            data: {
                filename: filename,
                originalName: filename,
                source: 'SCANNER',
                fileUrl: key,
                content: extractedText || null,
                ocrStatus: extractedText ? 'COMPLETED' : 'PENDING'
            }
        });

        log.info({ filename, id: inboxDoc.id }, 'Registered new inbox document');

        // 4. Automation Logic
        if (qrData && qrData.eid && qrData.t) {
            const employeeId = qrData.eid;
            const date = qrData.d?.split('T')[0] || new Date().toISOString().split('T')[0];

            let category = 'Otros';
            let name = `Documento Auto ${date}`;

            // DB Lookup for Mapping
            const mapping = await prisma.fileMapping.findFirst({
                where: { qrType: qrData.t }
            });

            if (mapping) {
                category = mapping.category;
                name = mapping.namePattern
                    .replace('{{date}}', date)
                    .replace('{{deviceName}}', qrData.name || 'Dispositivo');
            } else {
                log.warn({ type: qrData.t }, 'Unknown QR Type, using default category');
            }

            log.info({ employeeId, category, name }, 'QR/Meta Found! Auto-assigning document');
            log.info({ employeeId, category, name }, 'QR/Meta Found! Auto-assigning document');
            await inboxService.assignDocument(inboxDoc.id, employeeId, category, name);

            // Notify via DB
            await NotificationService.notifyAdmins(
                'Documento Procesado Automáticamente',
                `Se ha archivado automáticamente: ${name}`,
                `/employees/${employeeId}/documents`
            );
        } else {
            // Broadcast Notification via DB for manual review
            await NotificationService.notifyAdmins(
                'Nuevo Documento en Bandeja',
                `Se ha recibido ${filename} para revisión manual`,
                `/inbox`
            );
        }

        // 5. Cleanup local file (if configured/needed)
        // If we are using S3, we can delete the local file.
        // For now, let's keep it safe or maybe delete it?
        // The previous code had a comment about it.
        // In a queue system, once processed, we should probably delete the temporary file if it was transient.
        // But since we are watching 'data/inbox', deleting it might be what we want to avoid re-reading?
        // Actually, if we delete it, chokidar sees 'unlink'.
        // Let's assume we delete it to keep the inbox clean.
        // fs.unlinkSync(filePath); 

    } catch (error) {
        log.error({ filename, error }, 'Error processing file job');
        throw error; // Let BullMQ handle retries
    }
};

/**
 * Extracts QR data from an image buffer using jsQR.
 */
async function scanImageForQR(buffer: Buffer): Promise<any | null> {
    try {
        const png = require('pngjs').PNG;
        const jpeg = require('jpeg-js');

        let imageData: { data: Uint8ClampedArray | Buffer, width: number, height: number } | null = null;

        // Try detecting format (basic signature check)
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            // PNG
            const pngData = await new Promise<any>((resolve, reject) => {
                new png().parse(buffer, (error: any, data: any) => {
                    if (error) reject(error);
                    else resolve(data);
                });
            });
            imageData = { data: pngData.data, width: pngData.width, height: pngData.height };
        } else if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
            // JPEG
            const jpegData = jpeg.decode(buffer, { useTArray: true }); // useTArray for Uint8Array
            imageData = { data: jpegData.data, width: jpegData.width, height: jpegData.height };
        }

        if (imageData) {
            // jsQR expects Uint8ClampedArray
            const clamped = new Uint8ClampedArray(imageData.data);
            const code = jsQR(clamped, imageData.width, imageData.height);
            if (code && code.data) {
                try {
                    return JSON.parse(code.data);
                } catch {
                    return null; // Valid QR but not JSON
                }
            }
        }
        return null;
    } catch (e) {
        console.error('Error scanning image:', e);
        return null;
    }
}

/**
 * Assigns a pending document to an employee.
 */

