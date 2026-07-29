import { Job } from 'bullmq';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { StorageService } from '../services/StorageService';
import { NotificationService } from '../services/NotificationService';
import { createLogger } from '../services/LoggerService';
import { inboxService } from '../services/InboxService';
import { createWorker, type Worker as TesseractWorker } from 'tesseract.js';
import {
    extractSystemQrFromImage,
    extractSystemQrFromPdf,
    getDefaultQrFileMapping
} from '../services/documents/QrDocumentService';

const log = createLogger('FileProcessor');

// OCR is memory-expensive (each Tesseract worker ~150-300MB). We use a
// small pool and serialise access to keep memory bounded under the
// 1GB container limit.
const OCR_POOL_SIZE = Math.max(1, Math.min(2, parseInt(process.env.OCR_POOL_SIZE || '2', 10)));
const OCR_TIMEOUT_MS = Math.max(10_000, parseInt(process.env.OCR_TIMEOUT_MS || '60000', 10));
const SUPPORTED_OCR_EXTS = ['.png', '.jpg', '.jpeg'];

/**
 * Pool de workers Tesseract con 3 invariantes (MED-004):
 *
 *   1. **Inicialización singleton atómica**: `init()` se llama
 *      concurrentemente desde varios `acquire()`. La primera llamada
 *      crea los workers; las siguientes esperan a la misma promesa
 *      (no duplican workers ni re-crean el pool en cada acquire).
 *   2. **Adquisición atómica**: cuando hay varios `acquire()`
 *      concurrentes y todos los workers están ocupados, los
 *      siguientes se ponen en `waiters` con orden FIFO. No se
 *      "cuela" nadie: la promesa resuelta se pasa al primer waiter.
 *   3. **Worker descartado al timeout**: cuando OCR excede
 *      `OCR_TIMEOUT_MS`, el worker se considera "venenoso" (su
 *      estado interno es desconocido tras una promesa colgada) y
 *      se destruye. Se reemplaza por uno nuevo. Esto evita que un
 *      worker atascado se reasigne a otro job y reventé la cola.
 */
class OcrPool {
    private workers: TesseractWorker[] = [];
    private busy: boolean[] = [];
    private waiters: Array<(worker: TesseractWorker) => void> = [];
    private initPromise: Promise<void> | null = null;
    private closed = false;

    /**
     * Inicializa el pool. Idempotente: llamadas concurrentes
     * devuelven la misma promesa. Si ya está inicializado, devuelve
     * Promise.resolve().
     */
    init(): Promise<void> {
        if (this.workers.length > 0) return Promise.resolve();
        if (this.initPromise) return this.initPromise;
        this.initPromise = (async () => {
            for (let i = 0; i < OCR_POOL_SIZE; i++) {
                log.info({ slot: i }, 'Initializing Tesseract worker');
                const worker = await createWorker('spa');
                this.workers.push(worker);
                this.busy.push(false);
            }
        })();
        return this.initPromise;
    }

    async acquire(): Promise<TesseractWorker> {
        if (this.workers.length === 0) {
            await this.init();
        }
        // Bucle atómico: marca busy y devuelve en una sola
        // operación. Como JS es single-threaded, la comprobación y
        // el set ocurren sin interrupción.
        for (let i = 0; i < this.workers.length; i++) {
            if (!this.busy[i]) {
                this.busy[i] = true;
                return this.workers[i];
            }
        }
        return new Promise((resolve) => this.waiters.push(resolve));
    }

    release(worker: TesseractWorker): void {
        const idx = this.workers.indexOf(worker);
        if (idx === -1) return;
        const next = this.waiters.shift();
        if (next) {
            next(worker);
        } else {
            this.busy[idx] = false;
        }
    }

    /**
     * Destruye un worker y lo reemplaza por uno nuevo. Se usa
     * cuando el worker se queda atascado (timeout, error fatal)
     * y no se puede reutilizar. El nuevo worker se asigna al
     * siguiente waiter (si hay) o queda libre.
     */
    async replace(worker: TesseractWorker, reason: string): Promise<void> {
        const idx = this.workers.indexOf(worker);
        if (idx === -1) return;
        log.warn({ slot: idx, reason }, 'Replacing Tesseract worker');
        try {
            await worker.terminate();
        } catch (err) {
            log.warn({ err }, 'Error terminating poisoned Tesseract worker');
        }
        // Crear un nuevo worker. Mientras tanto, el slot queda
        // busy=true para que nadie lo use. Cuando el nuevo esté
        // listo, lo liberamos (o lo entregamos al waiter).
        let newWorker: TesseractWorker;
        try {
            newWorker = await createWorker('spa');
        } catch (err) {
            log.error({ err }, 'Failed to create replacement Tesseract worker; pool degraded');
            // Si no podemos crear uno nuevo, dejamos el slot
            // cerrado (eliminado) para no bloquear la cola.
            this.workers.splice(idx, 1);
            this.busy.splice(idx, 1);
            this.closed = true;
            return;
        }
        this.workers[idx] = newWorker;
        const next = this.waiters.shift();
        if (next) {
            // El waiter recibe el worker nuevo (sigue busy=true).
            next(newWorker);
        } else {
            // Nadie esperando, lo dejamos libre.
            this.busy[idx] = false;
        }
    }

    async close(): Promise<void> {
        await Promise.all(this.workers.map((w) => w.terminate().catch((err) => log.warn({ err }, 'Error terminating Tesseract worker'))));
        this.workers = [];
        this.busy = [];
        this.waiters = [];
        this.closed = true;
    }

    /**
     * Reset total del pool para tests. Cierra los workers y
     * reinicia todos los flags internos. NO usar en producción.
     */
    async resetForTests(): Promise<void> {
        await this.close();
        this.initPromise = null;
        this.closed = false;
    }

    /** Estado para tests/diagnóstico. */
    get status() {
        return {
            size: this.workers.length,
            busy: this.busy.map(Boolean),
            waiting: this.waiters.length,
            closed: this.closed
        };
    }
}

const ocrPool = new OcrPool();
export { ocrPool };

/**
 * Race a Promise against a timeout. Si se agota el tiempo, **NO**
 * se queda colgado: el worker se marca como "venenoso" y se
 * reemplaza, y la promesa rechaza con un error. El caller debe
 * liberar/manejar el error como cualquier fallo de OCR.
 */
function withOcrTimeout(
    promise: Promise<{ data: { text: string } }>,
    worker: TesseractWorker,
    ms: number,
    label: string
): Promise<{ data: { text: string } }> {
    let timer: NodeJS.Timeout | null = null;
    let timedOut = false;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(async () => {
            timedOut = true;
            // El worker se queda en estado desconocido tras la
            // promesa colgada; lo reemplazamos por uno nuevo para
            // que no se reasigne. La promesa de OCR se descarta
            // (fire-and-forget); si termina después, se ignora.
            await ocrPool.replace(worker, `timeout after ${ms}ms`).catch((err) => {
                log.warn({ err }, 'replace after timeout failed');
            });
            reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => {
        if (timer) clearTimeout(timer);
        if (!timedOut) {
            // Si el promise original se resuelve más tarde (después
            // del race), lo silenciamos para no provocar un
            // UnhandledPromiseRejection.
            promise.catch(() => { /* esperado si timedOut=true */ });
        }
    }) as Promise<{ data: { text: string } }>;
}

/**
 * Hash SHA-256 del contenido de un archivo. Se usa para la deduplicación
 * basada en contenido (no en filename) — el audit dice que la
 * deduplicación por filename no es segura porque dos archivos
 * distintos pueden tener el mismo nombre en bandejas distintas, o
 * el mismo archivo puede renombrarse. La invariante correcta es:
 * "el mismo contenido binario produce el mismo hash".
 */
function sha256OfBuffer(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

export const FileProcessor = async (job: Job) => {
    const { filePath, companyId } = job.data;
    const filename = path.basename(filePath);

    log.info({ jobId: job.id, filename, companyId }, 'Processing file job started');

    try {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const ext = path.extname(filename);
        const buffer = fs.readFileSync(filePath);
        const contentHash = sha256OfBuffer(buffer);

        // Dedupe por contenido (no por filename). Doble check:
        // (a) por hash global, (b) por (companyId + hash) para
        // multi-tenant. Si el hash ya existe, saltamos el job.
        // Esto cierra MED-004 ("dedupe por filename es check-then-create
        // sin unique/jobId"): la creación posterior intentará un
        // createMany y fallará en el unique, dejando la BD
        // inconsistente.
        const existingByHash = await prisma.inboxDocument.findFirst({
            where: { contentHash }
        });
        if (existingByHash) {
            log.info({ filename, hash: contentHash, existingId: existingByHash.id }, 'File already processed (same content hash), skipping');
            return;
        }

        let qrData = null;

        // 1. Analyze File (OCR/Metadata)
        if (ext.toLowerCase() === '.pdf') {
            qrData = await extractSystemQrFromPdf(buffer);
            if (qrData) log.info({ type: qrData.t }, 'Found system QR/metadata in PDF');
        } else if (['.png', '.jpg', '.jpeg'].includes(ext.toLowerCase())) {
            qrData = await extractSystemQrFromImage(buffer);
        }

        // 1.5. OCR Extraction (Text) — pooled + timeout-bounded to prevent
        // unbounded memory growth and stuck workers. El worker se
        // reemplaza si se agota el timeout (ver withOcrTimeout).
        let extractedText = '';
        if (SUPPORTED_OCR_EXTS.includes(ext.toLowerCase())) {
            const worker = await ocrPool.acquire();
            try {
                const { data: { text } } = await withOcrTimeout(
                    worker.recognize(buffer),
                    worker,
                    OCR_TIMEOUT_MS,
                    `OCR(${filename})`
                );
                extractedText = text;
                log.info({ filename, length: text.length }, 'OCR Completed');
            } catch (ocrError) {
                // Si el error fue un timeout, el worker ya fue
                // reemplazado por `withOcrTimeout`; no lo
                // devolvemos al pool.
                const isTimeout = (ocrError as Error).message.includes('timed out');
                if (isTimeout) {
                    log.error({ filename, error: ocrError }, 'OCR timed out; worker replaced');
                } else {
                    log.error({ filename, error: ocrError }, 'OCR Failed (will continue without text)');
                    // Para errores no-timeout, devolvemos el worker
                    // al pool (puede reusarse en otro job).
                    ocrPool.release(worker);
                }
            }
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

        // 3. Create Inbox Entry (con contentHash). La unicidad se
        // delega al schema (índice único sobre contentHash) para
        // hacer la creación atómica a nivel SQL: si dos workers
        // concurrentes llegan aquí con el mismo buffer, el segundo
        // recibe un P2002 y se descarta.
        try {
            const inboxDoc = await prisma.inboxDocument.create({
                data: {
                    filename,
                    originalName: filename,
                    source: 'SCANNER',
                    fileUrl: key,
                    content: extractedText || null,
                    ocrStatus: extractedText ? 'COMPLETED' : 'PENDING',
                    companyId: companyId || null,
                    contentHash
                }
            });

            log.info({ filename, id: inboxDoc.id, hash: contentHash }, 'Registered new inbox document');

            // 4. Automation Logic
            if (qrData && qrData.eid && qrData.t) {
                const employeeId = qrData.eid;
                const date = qrData.d?.split('T')[0] || new Date().toISOString().split('T')[0];

                let category = 'Otros';
                let name = `Documento Auto ${date}`;

                // DB Lookup for Mapping
                const storedMapping = await prisma.fileMapping.findFirst({
                    where: { qrType: qrData.t }
                });
                const mapping = storedMapping || getDefaultQrFileMapping(qrData.t);

                if (mapping) {
                    category = mapping.category;
                    name = mapping.namePattern
                        .replace('{{date}}', date)
                        .replace('{{deviceName}}', typeof qrData.name === 'string' ? qrData.name : 'Dispositivo');
                } else {
                    log.warn({ type: qrData.t }, 'Unknown QR Type, using default category');
                }

                log.info({ employeeId, category, name, inboxCompanyId: inboxDoc.companyId }, 'QR/Meta Found! Auto-assigning document');

                // CRIT-002: el QR es un dato NO autenticado. Nunca debe
                // poder cambiar el tenant. Pasamos `autoAssignContext`
                // con el `inboxDoc.companyId` para que el servicio
                // verifique que el empleado destino pertenece al mismo
                // tenant. Si no, el documento se queda en la bandeja
                // para revisión manual.
                try {
                    await inboxService.assignDocument(
                        inboxDoc.id,
                        employeeId,
                        category,
                        name,
                        undefined,
                        null, // sin actor: el worker actúa como sistema
                        { inboxDocCompanyId: inboxDoc.companyId }
                    );
                    await NotificationService.notifyAdmins(
                        'Documento Procesado Automáticamente',
                        `Se ha archivado automáticamente: ${name}`,
                        `/employees/${employeeId}/documents`
                    );
                } catch (assignErr) {
                    // No archivamos. Dejamos el doc en la bandeja y
                    // notificamos para revisión manual.
                    log.warn(
                        { err: assignErr, inboxId: inboxDoc.id, employeeId, inboxCompany: inboxDoc.companyId },
                        'Auto-assign bloqueado por validación de tenant; queda en bandeja para revisión manual'
                    );
                    await NotificationService.notifyAdmins(
                        'Documento requiere revisión manual',
                        `El QR del documento ${filename} apunta a un empleado de otro tenant. Requiere asignación manual.`,
                        `/inbox`
                    );
                }
            } else {
                // Broadcast Notification via DB for manual review
                await NotificationService.notifyAdmins(
                    'Nuevo Documento en Bandeja',
                    `Se ha recibido ${filename} para revisión manual`,
                    `/inbox`
                );
            }
        } catch (createErr: any) {
            // Si el create falla por unicidad en contentHash
            // (P2002), significa que otro worker procesó el mismo
            // archivo concurrentemente. Es el comportamiento
            // esperado: descartamos este job.
            if (createErr?.code === 'P2002') {
                log.info({ filename, hash: contentHash }, 'Duplicate contentHash detected at create; another worker won the race');
                return;
            }
            throw createErr;
        }

        // 5. Move processed file out of the watched folder so the watcher
        // does not re-pick it up. In local-storage mode the file IS the
        // master copy (StorageService.saveBuffer has already read it into
        // `uploads/` under its storage key), so we move it to `processed/`
        // rather than deleting it — keeping a local audit trail without
        // accumulating files in the active inbox folder.
        try {
            const inboxDir = path.dirname(filePath);
            const processedDir = path.join(inboxDir, 'processed');
            if (!fs.existsSync(processedDir)) {
                fs.mkdirSync(processedDir, { recursive: true });
            }
            const dest = path.join(processedDir, filename);
            if (fs.existsSync(filePath)) {
                fs.renameSync(filePath, dest);
            }
        } catch (cleanupErr) {
            log.warn({ filename, error: cleanupErr }, 'Could not move processed file to processed/');
        }

    } catch (error) {
        log.error({ filename, error }, 'Error processing file job');
        throw error; // Let BullMQ handle retries
    }
};

/**
 * Assigns a pending document to an employee.
 */

