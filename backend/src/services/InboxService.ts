import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import * as chokidar from 'chokidar';
import { queueService, QUEUES } from './QueueService';
import { loggers } from './LoggerService';
import { DEFAULT_QR_FILE_MAPPINGS } from './documents/QrDocumentService';

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
            log.info('Ensuring default file mappings...');
            await (prisma as any).fileMapping.createMany({
                data: DEFAULT_QR_FILE_MAPPINGS,
                skipDuplicates: true
            });
        } catch {
            log.error('Error seeding mappings');
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
            ignored: (p: string) => {
                const base = path.basename(p);
                if (base.startsWith('.')) return true;
                if (base === 'processed') return true;
                return false;
            },
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
                if (fs.statSync(path.join(this.inboxDir, file)).isDirectory() || file.startsWith('.') || file === 'processed') continue;
                await this.processFile(path.join(this.inboxDir, file));
            }
        } catch (err) {
            log.error({ error: err }, 'Error syncing folder');
        }
    }

    async processFile(filePath: string, companyId?: string | null) {
        const filename = path.basename(filePath);
        if (this.processing.has(filename)) return;
        this.processing.add(filename);

        try {
            log.info({ filename, companyId }, 'Enqueuing file for processing');
            await queueService.addJob(QUEUES.INGESTION, 'process-file', { filePath, companyId: companyId || null }, {
                removeOnComplete: true,
                removeOnFail: 100 // Keep last 100 failed jobs
            });
        } catch (err) {
            log.error({ error: err, filename }, 'Error enqueuing file');
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
                        await client.messageFlagsAdd(uid.toString(), ['Seen']);
                    }
                }
            } finally {
                lock.release();
            }
            await client.logout();
        } catch (_) {
            log.error({ error: _ }, 'Error polling emails');
        } finally {
            this.processing.delete('email-poll');
        }
    }
    /**
     * Assigns a pending document to an employee.
     *
     * CRIT-002: este método valida explícitamente que el documento
     * de bandeja y el empleado destino pertenecen al tenant del
     * actor. Si no, lanza un error. Antes del fix se confiaba en
     * que el caller ya había comprobado, pero el `resolveAssignTarget`
     * del router solo verificaba el empleado, no el inbox doc.
     *
     * `actor` es opcional para compatibilidad con el worker
     * `FileProcessor`, que actúa como "sistema" sin tenant. En ese
     * caso, la validación se delega a la lógica de auto-assign que
     * cruza `inboxDoc.companyId` con `employee.companyId`.
     */
    async assignDocument(
        inboxId: string,
        employeeId: string,
        category: string,
        name: string,
        expiryDate?: string,
        actor?: { id?: string; role?: string; companyId?: string | null } | null,
        autoAssignContext?: { inboxDocCompanyId?: string | null }
    ) {
        const inboxDoc = await (prisma as any).inboxDocument.findUnique({
            where: { id: inboxId }
        });

        if (!inboxDoc || inboxDoc.processed) {
            throw new Error('Documento no encontrado o ya procesado');
        }

        const fileKey = inboxDoc.fileUrl;
        if (!fileKey) throw new Error('Documento sin archivo asociado');

        // Verificamos el empleado destino
        const employee = await (prisma as any).employee.findUnique({
            where: { id: employeeId },
            select: { id: true, companyId: true }
        });
        if (!employee) {
            throw new Error('Empleado destino no encontrado');
        }

        // CRIT-002 — defensa multi-capa:
        //   1) Si hay `actor` explícito (ruta HTTP), exigimos que el
        //      inbox doc y el empleado pertenezcan a su tenant.
        //   2) Si NO hay actor (auto-assign del worker), exigimos que
        //      inboxDoc.companyId y employee.companyId coincidan. Si
        //      alguno es null, no auto-asignamos: el QR es
        //      insuficiente para establecer una relación cross-tenant.
        if (actor) {
            const isGlobal = actor.role === 'admin' && !actor.companyId;
            if (!isGlobal) {
                if (!actor.companyId) {
                    throw new Error('Usuario sin empresa asignada no puede asignar documentos');
                }
                if (inboxDoc.companyId !== actor.companyId) {
                    log.warn({ inboxId, employeeId, actorId: actor.id, inboxCompanyId: inboxDoc.companyId }, 'Cross-tenant inbox assign blocked (inbox doc)');
                    throw new Error('Documento no encontrado o de otro tenant');
                }
                if (employee.companyId !== actor.companyId) {
                    log.warn({ inboxId, employeeId, actorId: actor.id, employeeCompanyId: employee.companyId }, 'Cross-tenant inbox assign blocked (target employee)');
                    throw new Error('Empleado destino de otro tenant');
                }
            }
        } else {
            // Modo worker (auto-assign desde QR)
            const inboxCompany = autoAssignContext?.inboxDocCompanyId ?? inboxDoc.companyId;
            if (inboxCompany && employee.companyId !== inboxCompany) {
                log.warn({ inboxId, employeeId, inboxCompany, employeeCompany: employee.companyId }, 'Cross-tenant auto-assign blocked (QR/metadata employee mismatch)');
                throw new Error('Empleado del QR pertenece a otro tenant que el documento');
            }
            if (!inboxCompany) {
                log.warn({ inboxId, employeeId }, 'Inbox doc sin empresa no se puede auto-asignar (sin contexto del actor)');
                throw new Error('Documento sin empresa asignada: requiere revisión manual');
            }
        }

        const document = await prisma.$transaction(async (tx) => {
            // Compare-and-set: solo actualizamos si processed sigue
            // en false, para evitar carrera con otra asignación.
            const updateResult = await tx.inboxDocument.updateMany({
                where: { id: inboxId, processed: false },
                data: { processed: true, processedAt: new Date() }
            });
            if (updateResult.count === 0) {
                throw new Error('El documento ya fue procesado por otra operación');
            }
            const doc = await tx.document.create({
                data: {
                    employeeId,
                    name: name || inboxDoc.originalName,
                    category,
                    fileUrl: fileKey,
                    content: inboxDoc.content,
                    expiryDate: expiryDate ? new Date(expiryDate) : null
                }
            });
            return doc;
        });

        return document;
    }
}

export const inboxService = new InboxService();
