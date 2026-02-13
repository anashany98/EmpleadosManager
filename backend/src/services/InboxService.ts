import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import jsQR from 'jsqr';
import { PDFDocument } from 'pdf-lib';
import * as chokidar from 'chokidar';
import { queueService, QUEUES } from './QueueService';
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
     * Initialize default mappings if none exist
     */
    private async initializeMappings() {
        try {
            const count = await (prisma as any).fileMapping.count();
            if (count === 0) {
                log.info('Seeding default file mappings...');
                await (prisma as any).fileMapping.createMany({
                    data: [
                        { qrType: 'VACATION', category: 'Justificante Ausencia', namePattern: 'Justificante Auto {{date}}' },
                        { qrType: 'EPI', category: 'PRL', namePattern: 'Entrega EPIs Firmado {{date}}' },
                        { qrType: 'UNIFORME', category: 'PRL', namePattern: 'Entrega Uniforme Firmado {{date}}' },
                        { qrType: 'TECH_DEVICE', category: 'Equipamiento', namePattern: 'Entrega {{deviceName}} Firmado {{date}}' },
                        { qrType: 'MODEL_145', category: 'Contrato', namePattern: 'Modelo 145 Firmado {{date}}' },
                        { qrType: 'PAYROLL_SIGNED', category: 'Nómina', namePattern: 'Nómina Firmada {{date}}' }
                    ]
                });
            }
        } catch (error) {
            log.error({ error }, 'Error seeding mappings');
        }
    }

    /**
     * Starts the Inbox Service: File Watcher and Email Polling.
     */
    public start() {
        log.info('Starting...');

        // 0. Initialize Mappings
        this.initializeMappings();

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
            log.info({ filename }, 'Enqueuing file for processing');
            await queueService.addJob(QUEUES.INGESTION, 'process-file', { filePath }, {
                removeOnComplete: true,
                removeOnFail: 100 // Keep last 100 failed jobs
            });
        } catch (error) {
            log.error({ filename, error }, 'Error enqueuing file');
        } finally {
            this.processing.delete(filename);
        }
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
                content: inboxDoc.content, // Transfer captured text
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
}

export const inboxService = new InboxService();
