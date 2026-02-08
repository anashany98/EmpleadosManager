import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import jsQR from 'jsqr';
import { PDFDocument } from 'pdf-lib';
import * as chokidar from 'chokidar';
import { StorageService } from './StorageService';
import { NotificationService } from './NotificationService';
import { loggers } from './LoggerService';

const log = loggers.inbox;

export class InboxService {
    private inboxDir = path.join(process.cwd(), 'data', 'inbox');
    private processing = new Set<string>(); // prevent double processing
    private emailInterval: NodeJS.Timeout | null = null;
    private watcher: chokidar.FSWatcher | null = null;

    constructor() {
        // Ensure directories exist
        if (!fs.existsSync(this.inboxDir)) {
            fs.mkdirSync(this.inboxDir, { recursive: true });
        }
    }

    /**
     * Starts the Inbox Service: File Watcher and Email Polling.
     */
    public start() {
        log.info('Starting...');

        // 1. Start File Watcher
        this.startWatcher();

        // 2. Start Email Polling (every 5 minutes)
        this.pollEmails(); // Run once immediately
        this.emailInterval = setInterval(() => {
            this.pollEmails();
        }, 5 * 60 * 1000);

        log.info('Service started. Watching for files and emails.');
    }

    public stop() {
        if (this.emailInterval) clearInterval(this.emailInterval);
        if (this.watcher) this.watcher.close();
        log.info('Service stopped.');
    }

    private startWatcher() {
        // Initialize watcher. Ignore dotfiles and initial scan (we process existing on demand or startup?)
        // Let's process existing on startup too? Maybe risky if huge backlog.
        // For now, ignoreInitial: true to avoid reprocessing old files every restart unless we want to retry failed ones.
        // Better: ignoreInitial: true, and have a separate 'retryPending' method if needed.
        this.watcher = chokidar.watch(this.inboxDir, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100
            }
        });

        this.watcher
            .on('add', (filePath) => {
                log.info({ file: path.basename(filePath) }, 'New file detected');
                this.processFile(filePath);
            })
            .on('error', error => log.error({ error }, 'Watcher error'));
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
     * 3. Auto-assign if possible
     */
    async syncFolder() {
        try {
            const files = fs.readdirSync(this.inboxDir);
            for (const file of files) {
                if (fs.statSync(path.join(this.inboxDir, file)).isDirectory() || file.startsWith('.')) continue;
                await this.processFile(path.join(this.inboxDir, file));
            }
        } catch (error) {
            log.error({ error }, 'Error syncing folder');
        }
    }

    async processFile(filePath: string) {
        const filename = path.basename(filePath);
        if (this.processing.has(filename)) return;
        this.processing.add(filename);

        try {
            // Check if already in DB
            const existing = await (prisma as any).inboxDocument.findFirst({
                where: { filename: filename }
            });

            if (existing) {
                log.debug({ filename }, 'File already in DB, skipping');
                return;
            }

            const ext = path.extname(filename);
            // Rename to UUID if not already? The watchers pick up renames as 'add' sometimes?
            // If we rename it here, watcher might fire again for new name.
            // Best practice: Move to a 'processing' folder or just use the name if it's already UUID (from email/upload).
            // Let's assume files strictly arriving are UUID-named or we rename them.
            // If we rename, we should ignore the new name event?
            // Simplified: Just process in place. If renamed later, handled separately.

            // If coming from email/upload, name is already uuid.

            const buffer = fs.readFileSync(filePath);
            let qrData = null;

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
                qrData = await this.scanImageForQR(buffer);
            }

            // Store in central storage
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

            // Create Inbox Entry
            const inboxDoc = await (prisma as any).inboxDocument.create({
                data: {
                    filename: filename,
                    originalName: filename, // Or try to get real original name if passed in sidecar?
                    source: 'SCANNER',
                    fileUrl: key
                }
            });

            log.info({ filename }, 'Registered new document');

            // Automation Logic
            if (qrData && qrData.eid && qrData.t) {
                const employeeId = qrData.eid;
                const date = qrData.d?.split('T')[0] || new Date().toISOString().split('T')[0];

                let category = 'Otros';
                let name = `Documento Auto ${date}`;

                switch (qrData.t) {
                    case 'VACATION': category = 'Justificante Ausencia'; name = `Justificante Auto ${date}`; break;
                    case 'EPI': category = 'PRL'; name = `Entrega EPIs Firmado ${date}`; break;
                    case 'UNIFORME': category = 'PRL'; name = `Entrega Uniforme Firmado ${date}`; break;
                    case 'TECH_DEVICE': category = 'Equipamiento'; name = `Entrega ${qrData.name || 'Dispositivo'} Firmado ${date}`; break;
                    case 'MODEL_145': category = 'Contrato'; name = `Modelo 145 Firmado ${date}`; break;
                    case 'PAYROLL_SIGNED': category = 'Nómina'; name = `Nómina Firmada ${date}`; break;
                }

                log.info({ employeeId, category, name }, 'QR/Meta Found! Auto-assigning document');
                await this.assignDocument(inboxDoc.id, employeeId, category, name);

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

            // Cleanup local if using S3?
            if (StorageService.provider === 's3') {
                // fs.unlinkSync(filePath); // Be careful with watcher loops!
                // If we delete it, watcher might fire 'unlink'. reliable.
            }

        } catch (error) {
            log.error({ filename, error }, 'Error processing file');
        } finally {
            this.processing.delete(filename);
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

        const fileKey = inboxDoc.fileUrl;
        if (!fileKey) throw new Error('Documento sin archivo asociado');

        // Create permanent Document entry
        const document = await prisma.document.create({
            data: {
                employeeId,
                name: name || inboxDoc.originalName,
                category,
                fileUrl: fileKey,
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
        if (this.processing.has('email-poll')) return;
        this.processing.add('email-poll');

        try {
            // 1. Get configuration
            const configEntry = await (prisma as any).configuration.findUnique({ where: { key: 'inbox_settings' } });
            if (!configEntry) return;

            const config = JSON.parse(configEntry.value);
            if (!config.emailEnabled || !config.imap?.host) return;

            // 2. Connect to IMAP
            const client = new ImapFlow({
                host: config.imap.host,
                port: config.imap.port || 993,
                secure: config.imap.tls !== false,
                auth: { user: config.imap.user, pass: config.imap.password },
                logger: false
            });

            await client.connect();
            const lock = await client.getMailboxLock('INBOX');

            try {
                const uids = await client.search({ seen: false });
                if (Array.isArray(uids) && uids.length > 0) {
                    log.info({ count: uids.length }, 'Found new emails');
                    for (const uid of uids) {
                        const message = await client.fetchOne(uid.toString(), { source: true });
                        if (!message || typeof message === 'boolean' || !message.source) continue;

                        const parsed = await simpleParser(message.source);
                        if (parsed.attachments?.length) {
                            for (const attachment of parsed.attachments) {
                                const ext = path.extname(attachment.filename || '.pdf').toLowerCase();
                                if (['.pdf', '.png', '.jpg', '.jpeg'].includes(ext)) {
                                    const newFilename = `${uuidv4()}${ext}`;
                                    const filePath = path.join(this.inboxDir, newFilename);
                                    fs.writeFileSync(filePath, attachment.content);
                                    log.info({ filename: newFilename }, 'Saved email attachment');
                                    // Watcher will pick this up automatically!
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
        } catch (error) {
            log.error({ error }, 'Error polling emails');
        } finally {
            this.processing.delete('email-poll');
        }
    }
}

export const inboxService = new InboxService();
