import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import jsQR from 'jsqr';
// import { getDocument } from 'pdfjs-dist/legacy/build/pdf';
// import { createCanvas, Image as CanvasImage } from 'canvas';

import { notificationService } from './NotificationService';

export class InboxService {
    private inboxDir = path.join(process.cwd(), 'data', 'inbox');
    private documentsDir = path.join(process.cwd(), 'uploads', 'documents');

    constructor() {
        // Ensure directories exist
        if (!fs.existsSync(this.inboxDir)) {
            fs.mkdirSync(this.inboxDir, { recursive: true });
        }
        if (!fs.existsSync(this.documentsDir)) {
            fs.mkdirSync(this.documentsDir, { recursive: true });
        }
    }

    /**
     * Extracts QR data from an image buffer using jsQR.
     */
    private async scanImageForQR(buffer: Buffer): Promise<any | null> {
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
     * Extracts text/QR from PDF. Since we can't easily render PDF logic in node without heavy libs,
     * we will implement a basic check or just rely on image conversion if possible.
     * For now, let's assume we focus on images or use a specific pdf-lib if needed.
     * NOTE: PDF scanning is complex in Node. A robust solution uses pdf2pic to convert first page to image.
     * For now, we will just support Images or basic PDF structure if visible.
     */

    /**
     * Scans the inbox directory and synchronizes with the database.
     * New files are added to InboxDocument table.
     */
    async syncFolder() {
        try {
            const files = fs.readdirSync(this.inboxDir);

            for (const file of files) {
                // Skip directories and hidden files
                if (fs.statSync(path.join(this.inboxDir, file)).isDirectory() || file.startsWith('.')) continue;

                // Check if already in DB by current filename
                const existing = await (prisma as any).inboxDocument.findFirst({
                    where: { filename: file }
                });

                if (!existing) {
                    const ext = path.extname(file);
                    const newFilename = `${uuidv4()}${ext}`;
                    const sourcePath = path.join(this.inboxDir, file);
                    const destPath = path.join(this.inboxDir, newFilename);

                    fs.renameSync(sourcePath, destPath);

                    // Try to auto-process with scanned QR or Metadata
                    const buffer = fs.readFileSync(destPath);
                    let qrData = null;

                    if (ext.toLowerCase() === '.pdf') {
                        try {
                            const { PDFDocument } = require('pdf-lib');
                            const pdfDoc = await PDFDocument.load(buffer);
                            const subject = pdfDoc.getSubject();
                            if (subject && subject.includes('VACATION')) {
                                try {
                                    qrData = JSON.parse(subject);
                                    console.log('[InboxService] Found QR Data in PDF Metadata!');
                                } catch (e) {
                                    console.warn('[InboxService] Failed to parse PDF metadata subject:', e);
                                }
                            }
                        } catch (e) {
                            console.error('[InboxService] Error reading PDF metadata:', e);
                        }
                    } else if (['.png', '.jpg', '.jpeg'].includes(ext.toLowerCase())) {
                        qrData = await this.scanImageForQR(buffer);
                    }

                    // Create Inbox Entry
                    const inboxDoc = await (prisma as any).inboxDocument.create({
                        data: {
                            filename: newFilename,
                            originalName: file,
                            source: 'SCANNER',
                            fileUrl: `/inbox/${newFilename}`
                        }
                    });

                    console.log(`[InboxService] Registered new document: ${file} -> ${newFilename}`);

                    // Broadcast Notification
                    notificationService.broadcast('INBOX_NEW_DOCUMENT', {
                        title: 'Nuevo Documento',
                        message: `Se ha recibido el archivo ${file}`,
                        filename: file
                    });

                    // Automation Logic
                    if (qrData && qrData.eid && qrData.t) {
                        const employeeId = qrData.eid;
                        const date = qrData.d?.split('T')[0] || '';

                        let category = 'Otros';
                        let name = `Documento Auto ${date}`;

                        switch (qrData.t) {
                            case 'VACATION':
                                category = 'Justificante Ausencia';
                                name = `Justificante Auto ${date}`;
                                break;
                            case 'EPI':
                                category = 'PRL';
                                name = `Entrega EPIs Firmado ${date}`;
                                break;
                            case 'UNIFORME':
                                category = 'PRL';
                                name = `Entrega Uniforme Firmado ${date}`;
                                break;
                            case 'TECH_DEVICE':
                                category = 'Equipamiento';
                                name = `Entrega ${qrData.name || 'Dispositivo'} Firmado ${date}`;
                                break;
                            case 'MODEL_145':
                                category = 'Contrato';
                                name = `Modelo 145 Firmado ${date}`;
                                break;
                        }

                        console.log(`[InboxService] QR Code Found (${qrData.t})! Auto-assigning to employee ${employeeId}...`);
                        await this.assignDocument(inboxDoc.id, employeeId, category, name);
                    }
                }
            }
        } catch (error) {
            console.error('[InboxService] Error syncing folder:', error);
        }
    }

    /**
     * Assigns a pending document to an employee.
     */
    async assignDocument(inboxId: string, employeeId: string, category: string, name: string, expiryDate?: string) {
        const inboxDoc = await (prisma as any).inboxDocument.findUnique({
            where: { id: inboxId }
        });

        if (!inboxDoc || inboxDoc.processed) {
            throw new Error('Documento no encontrado o ya procesado');
        }

        const sourcePath = path.join(this.inboxDir, inboxDoc.filename);
        const destFilename = `${uuidv4()}_${inboxDoc.filename}`;
        const destPath = path.join(this.documentsDir, destFilename);

        // Move file to permanent storage
        if (fs.existsSync(sourcePath)) {
            fs.renameSync(sourcePath, destPath);
        } else {
            console.error('File missing from inbox:', sourcePath);
            // If file missing but record exists, we might want to just fail or update record.
            // For now, let's assume valid flow.
            // But if auto-assigned immediately after rename in syncFolder, sourcePath might be correct.
        }

        // Create permanent Document entry
        const document = await prisma.document.create({
            data: {
                employeeId,
                name: name || inboxDoc.originalName,
                category,
                fileUrl: `/uploads/documents/${destFilename}`,
                expiryDate: expiryDate ? new Date(expiryDate) : null
            }
        });

        // Mark as processed
        await (prisma as any).inboxDocument.update({
            where: { id: inboxId },
            data: {
                processed: true,
                processedAt: new Date()
            }
        });

        return document;
    }

    /**
     * Polls the configured email inbox for new document attachments.
     */
    async pollEmails() {
        try {
            // 1. Get configuration
            const configEntry = await (prisma as any).configuration.findUnique({
                where: { key: 'inbox_settings' }
            });

            if (!configEntry) {
                console.log('[InboxService] No configuration found in database.');
                return;
            }

            const config = JSON.parse(configEntry.value);
            if (!config.emailEnabled) {
                console.log('[InboxService] Email polling is disabled in settings.');
                return;
            }

            if (!config.imap.host || !config.imap.user || !config.imap.password) {
                console.log('[InboxService] Missing IMAP credentials.');
                return;
            }

            console.log(`[InboxService] Connecting to ${config.imap.host} as ${config.imap.user}...`);

            // 2. Connect to IMAP
            const client = new ImapFlow({
                host: config.imap.host,
                port: config.imap.port || 993,
                secure: config.imap.tls !== false,
                auth: {
                    user: config.imap.user,
                    pass: config.imap.password
                },
                logger: false,
                verifyOnly: false
            });

            await client.connect();
            console.log('[InboxService] IMAP Connected.');

            // 3. Search and process
            const lock = await client.getMailboxLock('INBOX');
            try {
                const uids = await client.search({ seen: false });
                console.log(`[InboxService] Found ${Array.isArray(uids) ? uids.length : 0} unseen messages.`);

                if (Array.isArray(uids)) {
                    for (const uid of uids) {
                        const message = await client.fetchOne(uid.toString(), { source: true });
                        if (!message || !message.source) continue;

                        const parsed = await simpleParser(message.source);
                        console.log(`[InboxService] Processing email: ${parsed.subject}`);

                        if (parsed.attachments && parsed.attachments.length > 0) {
                            for (const attachment of parsed.attachments) {
                                const contentType = attachment.contentType?.toLowerCase() || '';
                                if (contentType.includes('pdf') || contentType.includes('image')) {
                                    const ext = path.extname(attachment.filename || '.pdf');
                                    const newFilename = `${uuidv4()}${ext}`;
                                    const filePath = path.join(this.inboxDir, newFilename);

                                    fs.writeFileSync(filePath, attachment.content);

                                    // Register directly in DB (syncFolder will pick up automations next run, or handled here?)
                                    // Let's just write file. syncFolder is called at end.
                                    // BUT syncFolder renames files from UUID to UUID which is duplicate.
                                    // Solution: Write with final UUID here and insert to DB, or just write random name and let syncFolder handle "new" files?
                                    // Best: Write attachment to inbox with random name, do NOT insert to DB, let syncFolder do full processing + QR Scan.

                                    // Reverting previous logic of manual insertion. Let syncFolder handle it.
                                    console.log(`[InboxService] Saved attachment ${newFilename}, waiting for sync.`);
                                }
                            }
                        }

                        await client.messageFlagsAdd(uid.toString(), ['\\Seen']);
                    }
                }
            } finally {
                lock.release();
            }

            await client.logout();

            // 4. Sync folder to register new files
            await this.syncFolder();

        } catch (error) {
            console.error('[InboxService] Error polling emails:', error);
        }
    }
}

export const inboxService = new InboxService();
