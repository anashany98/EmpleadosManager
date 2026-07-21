// MED-004: el pool OCR debe (1) inicializarse una sola vez bajo
// concurrencia, (2) admitir varios `acquire()` concurrentes sin
// pasarse del tamaño, (3) reemplazar workers venenosos tras
// timeout, y (4) el `FileProcessor` debe deduplicar por hash de
// contenido (no por filename).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Estado compartido por la factory de `vi.mock` y los tests.
// vi.mock se eleva al top, así que inicializamos lazy.
function getState() {
    if (!(globalThis as any).__med004State) {
        (globalThis as any).__med004State = {
            createCount: 0,
            terminateCount: 0,
            recognizeResolves: new Map<number, (v: any) => void>(),
            recognizeRejects: new Map<number, (e: any) => void>()
        };
    }
    return (globalThis as any).__med004State;
}

function makeMockWorker(id: number) {
    const s = getState();
    return {
        __id: id,
        recognize: vi.fn(() => new Promise<any>((resolve, reject) => {
            s.recognizeResolves.set(id, resolve);
            s.recognizeRejects.set(id, reject);
        })),
        terminate: vi.fn(async () => {
            s.terminateCount += 1;
        })
    };
}

vi.mock('tesseract.js', () => {
    const s = getState();
    return {
        createWorker: vi.fn(async () => {
            const id = s.createCount;
            s.createCount += 1;
            return makeMockWorker(id);
        })
    };
});

// Mock del resto del módulo para que `FileProcessor` se pueda
// importar sin reventar por sus dependencias (Prisma, Storage,
// etc.). Estos tests son de unidad: solo verifican el pool y el
// dedupe, no el flujo completo de FileProcessor.
vi.mock('../../lib/prisma', () => ({
    prisma: {
        inboxDocument: {
            findFirst: vi.fn(),
            create: vi.fn()
        },
        fileMapping: {
            findFirst: vi.fn()
        }
    }
}));

vi.mock('../../services/StorageService', () => ({
    StorageService: { saveBuffer: vi.fn(async () => ({ key: 'mock-key' })) }
}));
vi.mock('../../services/NotificationService', () => ({
    NotificationService: { notifyAdmins: vi.fn() }
}));
vi.mock('../../services/InboxService', () => ({
    inboxService: { assignDocument: vi.fn() }
}));

vi.mock('jsqr', () => ({ default: () => null }));
vi.mock('pdf-lib', () => ({
    PDFDocument: {
        load: vi.fn(async () => ({ getSubject: () => '' }))
    }
}));
vi.mock('pngjs', () => ({
    PNG() { /* noop */ }
}));
vi.mock('jpeg-js', () => ({
    default: { decode: () => null }
}));

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() => Buffer.from('mock-bytes')),
        mkdirSync: vi.fn(),
        renameSync: vi.fn()
    }
}));

import { ocrPool } from '../../workers/FileProcessor';
import { prisma } from '../../lib/prisma';

const POOL_SIZE = 2;
const state = getState();

describe('MED-004 — OcrPool', () => {
    beforeEach(async () => {
        state.createCount = 0;
        state.terminateCount = 0;
        state.recognizeResolves.clear();
        state.recognizeRejects.clear();
        await ocrPool.resetForTests();
    });

    afterEach(async () => {
        // Liberar workers que el test pueda haber dejado colgados
        // y resetear el estado para el siguiente test.
        await ocrPool.resetForTests();
    });

    it('init() es idempotente bajo concurrencia: 1 sola creación por slot', async () => {
        const inits = await Promise.all([
            ocrPool.init(),
            ocrPool.init(),
            ocrPool.init(),
            ocrPool.init()
        ]);
        expect(state.createCount).toBe(POOL_SIZE);
        for (const p of inits) {
            expect(p).toBeUndefined();
        }
    });

    it('acquire() concurrente: el pool nunca excede el tamaño', async () => {
        // Adquirimos 4 workers; los 2 primeros se devuelven
        // inmediatamente, los 2 últimos quedan en waiters (no se
        // resuelven hasta que alguien libere). Para evitar que el
        // test cuelgue, los liberamos manualmente después de
        // verificar el estado.
        const w1Promise = ocrPool.acquire();
        const w2Promise = ocrPool.acquire();
        const w3Promise = ocrPool.acquire();
        const w4Promise = ocrPool.acquire();

        // Esperar a que los 2 primeros se hayan asignado.
        await new Promise(r => setTimeout(r, 50));

        // Verificar el estado del pool: 2 busy, 2 waiting.
        expect(ocrPool.status.busy.filter(Boolean).length).toBe(POOL_SIZE);
        expect(ocrPool.status.waiting).toBe(2);

        // Liberar todo para que el test termine.
        const w1 = await w1Promise;
        const w2 = await w2Promise;
        ocrPool.release(w1);
        ocrPool.release(w2);
        const w3 = await w3Promise;
        const w4 = await w4Promise;
        expect([w1, w2, w3, w4].map(w => (w as any).__id))
            .toEqual(expect.arrayContaining([0, 1, 0, 1]));
    });

    it('release() despierta al siguiente waiter en orden FIFO', async () => {
        const w1 = await ocrPool.acquire();
        const w2 = await ocrPool.acquire();
        const promise3 = ocrPool.acquire();
        const promise4 = ocrPool.acquire();

        expect(ocrPool.status.waiting).toBe(2);

        ocrPool.release(w1);
        const w3 = await promise3;
        expect((w3 as any).__id).toBe((w1 as any).__id);
        expect(ocrPool.status.waiting).toBe(1);

        ocrPool.release(w2);
        const w4 = await promise4;
        expect((w4 as any).__id).toBe((w2 as any).__id);
        expect(ocrPool.status.waiting).toBe(0);
    });

    it('replace() termina el worker viejo y crea uno nuevo (worker venenoso)', async () => {
        const w1 = await ocrPool.acquire();
        const id1 = (w1 as any).__id;
        const beforeCreate = state.createCount;
        const beforeTerminate = state.terminateCount;

        await ocrPool.replace(w1, 'test poison');

        expect(state.terminateCount - beforeTerminate).toBe(1);
        expect(state.createCount - beforeCreate).toBe(1);

        const w2 = await ocrPool.acquire();
        const id2 = (w2 as any).__id;
        expect(id2).not.toBe(id1);
    });

    it('replace() despierta al waiter con el worker nuevo (no el viejo)', async () => {
        const w1 = await ocrPool.acquire();
        const w2 = await ocrPool.acquire();
        const id1 = (w1 as any).__id;
        const promise3 = ocrPool.acquire();

        await ocrPool.replace(w1, 'test poison before release');
        const w3 = await promise3;
        expect((w3 as any).__id).not.toBe(id1);
    });
});

describe('MED-004 — FileProcessor dedupe por contentHash', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('saltar el job si el hash ya existe', async () => {
        const findFirstSpy = vi.mocked(prisma.inboxDocument.findFirst);
        findFirstSpy.mockResolvedValueOnce({
            id: 'existing-doc',
            filename: 'doc.pdf',
            originalName: 'doc.pdf',
            source: 'SCANNER',
            fileUrl: 'k',
            contentHash: 'abc123'
        } as any);
        const createSpy = vi.mocked(prisma.inboxDocument.create);

        const { FileProcessor } = await import('../../workers/FileProcessor');
        const job = { data: { filePath: 'data/inbox/test.pdf', companyId: 'comp-1' }, id: 'job-1' } as any;
        await FileProcessor(job);

        expect(createSpy).not.toHaveBeenCalled();
    });

    it('rechaza creación duplicada con P2002 (race entre workers)', async () => {
        const findFirstSpy = vi.mocked(prisma.inboxDocument.findFirst);
        findFirstSpy.mockResolvedValueOnce(null);
        const createSpy = vi.mocked(prisma.inboxDocument.create);
        const p2002Error: any = new Error('Unique constraint failed');
        p2002Error.code = 'P2002';
        createSpy.mockRejectedValueOnce(p2002Error);

        const { FileProcessor } = await import('../../workers/FileProcessor');
        const job = { data: { filePath: 'data/inbox/test2.pdf', companyId: 'comp-1' }, id: 'job-2' } as any;
        await expect(FileProcessor(job)).resolves.toBeUndefined();
    });
});
