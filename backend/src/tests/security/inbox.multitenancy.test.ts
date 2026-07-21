// CRIT-002: Inbox + OCR + autoasignado rompen el aislamiento de tenant.
//
// Vectores cubiertos:
//   A) getAllPending: un usuario de A ve documentos con companyId:null
//      (documentos "huérfanos" que cualquier tenant ve).
//   B) download/delete: un usuario de A con un ID conocido de un doc null
//      puede descargarlo/borrarlo aunque no le pertenezca.
//   C) assign manual: un usuario de A puede asignar un doc null a un
//      empleado de B (o un doc de B a un empleado de A).
//   D) FileProcessor auto-assign: el QR de un doc de A contiene el
//      employeeId de B → el worker archiva el documento en B cambiando
//      el tenant sin verificar.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/prisma', () => {
    const inboxDocument = {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn()
    };
    const document = { create: vi.fn() };
    const employee = { findUnique: vi.fn() };
    const fileMapping = { findFirst: vi.fn() };
    const mockTx = (fn: any) => fn({ document, inboxDocument });
    return {
        prisma: {
            inboxDocument,
            document,
            employee,
            fileMapping,
            $transaction: vi.fn(mockTx)
        }
    };
});

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn().mockReturnValue(true),
        mkdirSync: vi.fn(),
        readdirSync: vi.fn().mockReturnValue([]),
        statSync: vi.fn().mockReturnValue({ isDirectory: () => false }),
        writeFileSync: vi.fn(),
        renameSync: vi.fn()
    }
}));

vi.mock('chokidar', () => ({
    watch: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), close: vi.fn() })
}));

vi.mock('./QueueService', () => ({
    QUEUES: { INGESTION: 'ingestion-queue' },
    queueService: { addJob: vi.fn().mockResolvedValue(undefined) }
}));

vi.mock('../../workers/FileProcessor', () => ({ ocrPool: { acquire: vi.fn(), release: vi.fn() } }));

vi.mock('../services/StorageService', () => ({
    StorageService: {
        provider: 'local',
        saveBuffer: vi.fn().mockResolvedValue({ key: 'inbox/test.pdf' }),
        deleteFile: vi.fn().mockResolvedValue(undefined),
        getSignedDownloadUrl: vi.fn().mockResolvedValue(null)
    }
}));

vi.mock('../services/NotificationService', () => ({
    NotificationService: { notifyAdmins: vi.fn().mockResolvedValue(undefined) }
}));

import { prisma } from '../../lib/prisma';
import { InboxService } from '../../services/InboxService';
import { InboxController } from '../../controllers/InboxController';
import { queueService } from '../../services/QueueService';

const mocked = prisma as unknown as {
    inboxDocument: {
        findUnique: ReturnType<typeof vi.fn>;
        findFirst: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
        count: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
    };
    document: { create: ReturnType<typeof vi.fn> };
    employee: { findUnique: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
};

const ACTOR_A = { id: 'user-A', role: 'admin', companyId: 'company-A', employeeId: null };
const ACTOR_B = { id: 'user-B', role: 'admin', companyId: 'company-B', employeeId: null };
const GLOBAL_ADMIN = { id: 'user-G', role: 'admin', companyId: null, employeeId: null };

const mockReq = (user: any, params: any = {}, body: any = {}, query: any = {}) => ({
    user, params, body, query
}) as any;
const mockRes = () => {
    const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        sendFile: vi.fn().mockReturnThis(),
        redirect: vi.fn().mockReturnThis()
    };
    return res;
};

describe('CRIT-002 — Inbox tenant isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('A) getAllPending', () => {
        it('usuario de A solo ve docs de su tenant (no docs null)', async () => {
            mocked.inboxDocument.findMany.mockResolvedValue([]);
            mocked.inboxDocument.count.mockResolvedValue(0);
            const req = mockReq(ACTOR_A, {}, {}, { limit: '10', page: '1' });
            const res = mockRes();
            await InboxController.getAllPending(req, res);
            const where = mocked.inboxDocument.findMany.mock.calls[0][0].where;
            expect(where.OR).toBeUndefined();
            expect(where.companyId).toBe('company-A');
            // CRÍTICO: no debe listar companyId:null
            expect(JSON.stringify(where)).not.toContain('null');
        });

        it('admin global ve todos los docs sin filtro', async () => {
            mocked.inboxDocument.findMany.mockResolvedValue([]);
            mocked.inboxDocument.count.mockResolvedValue(0);
            const req = mockReq(GLOBAL_ADMIN, {}, {}, { limit: '10', page: '1' });
            const res = mockRes();
            await InboxController.getAllPending(req, res);
            const where = mocked.inboxDocument.findMany.mock.calls[0][0].where;
            expect(where.companyId).toBeUndefined();
            expect(where.OR).toBeUndefined();
        });
    });

    describe('B) download / delete', () => {
        it('descargar un doc de companyId:null desde A devuelve 404, no 200', async () => {
            mocked.inboxDocument.findUnique.mockResolvedValue({
                id: 'doc-null',
                fileUrl: 'k',
                companyId: null
            });
            const req = mockReq(ACTOR_A, { id: 'doc-null' });
            const res = mockRes();
            await InboxController.download(req, res);
            // Debe rechazar (404) en lugar de proceder
            expect(res.status).toHaveBeenCalledWith(404);
            // Aseguramos que NO se leyó el archivo ni se generó URL
            expect(res.sendFile).not.toHaveBeenCalled();
            expect(res.redirect).not.toHaveBeenCalled();
        });

        it('borrar un doc de companyId:null desde A devuelve 404, no 200', async () => {
            mocked.inboxDocument.findUnique.mockResolvedValue({
                id: 'doc-null',
                fileUrl: 'k',
                companyId: null
            });
            const req = mockReq(ACTOR_A, { id: 'doc-null' });
            const res = mockRes();
            await InboxController.delete(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(mocked.inboxDocument.delete).not.toHaveBeenCalled();
        });

        it('borrar un doc de companyId=B desde A devuelve 404, no 200', async () => {
            mocked.inboxDocument.findUnique.mockResolvedValue({
                id: 'doc-B',
                fileUrl: 'k',
                companyId: 'company-B'
            });
            const req = mockReq(ACTOR_A, { id: 'doc-B' });
            const res = mockRes();
            await InboxController.delete(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(mocked.inboxDocument.delete).not.toHaveBeenCalled();
        });

        it('borrar un doc de companyId=A desde A funciona', async () => {
            mocked.inboxDocument.findUnique.mockResolvedValue({
                id: 'doc-A',
                fileUrl: 'k',
                companyId: 'company-A'
            });
            mocked.inboxDocument.delete.mockResolvedValue({ id: 'doc-A' });
            const req = mockReq(ACTOR_A, { id: 'doc-A' });
            const res = mockRes();
            await InboxController.delete(req, res);
            expect(res.status).not.toHaveBeenCalledWith(404);
            expect(res.status).not.toHaveBeenCalledWith(403);
            expect(mocked.inboxDocument.delete).toHaveBeenCalled();
        });
    });

    describe('C) assignDocument', () => {
        let service: InboxService;
        beforeEach(() => { service = new InboxService(); });

        it('asignar un doc de B a un empleado de A falla (cross-tenant)', async () => {
            mocked.inboxDocument.findUnique.mockResolvedValue({
                id: 'doc-B',
                fileUrl: 'k',
                companyId: 'company-B',
                processed: false,
                originalName: 'x.pdf',
                content: null
            });
            mocked.employee.findUnique.mockResolvedValue({
                id: 'emp-A',
                companyId: 'company-A'
            });
            // La ruta ya no es la única protección: el servicio debe validar tenant
            await expect(
                service.assignDocument('doc-B', 'emp-A', 'Cat', 'Name', undefined, ACTOR_A)
            ).rejects.toThrow(/no encontrad|tenant|empresa|forbidden|otro tenant/i);
            expect(mocked.document.create).not.toHaveBeenCalled();
            expect(mocked.inboxDocument.update).not.toHaveBeenCalled();
        });

        it('asignar un doc null a un empleado de A falla (huérfano)', async () => {
            mocked.inboxDocument.findUnique.mockResolvedValue({
                id: 'doc-null',
                fileUrl: 'k',
                companyId: null,
                processed: false,
                originalName: 'x.pdf',
                content: null
            });
            await expect(
                service.assignDocument('doc-null', 'emp-A', 'Cat', 'Name', undefined, ACTOR_A)
            ).rejects.toThrow(/no encontrad|tenant|empresa|forbidden|otro tenant/i);
            expect(mocked.document.create).not.toHaveBeenCalled();
        });

        it('asignar un doc de A a un empleado de A funciona', async () => {
            mocked.inboxDocument.findUnique.mockResolvedValue({
                id: 'doc-A',
                fileUrl: 'k',
                companyId: 'company-A',
                processed: false,
                originalName: 'x.pdf',
                content: null
            });
            mocked.employee.findUnique.mockResolvedValue({
                id: 'emp-A',
                companyId: 'company-A'
            });
            mocked.inboxDocument.updateMany.mockResolvedValue({ count: 1 });
            mocked.document.create.mockResolvedValue({ id: 'doc-new' });
            const result = await service.assignDocument('doc-A', 'emp-A', 'Cat', 'Name', undefined, ACTOR_A);
            expect(result).toMatchObject({ id: 'doc-new' });
            expect(mocked.document.create).toHaveBeenCalled();
            expect(mocked.inboxDocument.updateMany).toHaveBeenCalled();
        });
    });

    describe('D) FileProcessor auto-assign desde QR', () => {
        let service: InboxService;
        beforeEach(() => { service = new InboxService(); });

        it('NO archiva el doc en un empleado de otro tenant aunque el QR lo pida (modo worker)', async () => {
            // El inbox doc pertenece a company-A, pero el QR del PDF
            // dice "emp-B" (employee de company-B).
            mocked.inboxDocument.findUnique.mockResolvedValue({
                id: 'doc-A',
                fileUrl: 'k',
                companyId: 'company-A',
                processed: false,
                originalName: 'x.pdf',
                content: null
            });
            mocked.employee.findUnique.mockResolvedValue({
                id: 'emp-B',
                companyId: 'company-B'
            });
            mocked.inboxDocument.updateMany.mockResolvedValue({ count: 0 });

            // El worker llama a assignDocument SIN actor (actúa como
            // sistema) y pasa el companyId del inbox doc vía
            // autoAssignContext. La nueva validación debe BLOQUEAR.
            await expect(
                service.assignDocument(
                    'doc-A',
                    'emp-B',
                    'Justificante',
                    'Auto',
                    undefined,
                    null,
                    { inboxDocCompanyId: 'company-A' }
                )
            ).rejects.toThrow(/otro tenant|pertenece|sin empresa/i);

            // CRÍTICO: no debe haberse creado un Document vinculado a emp-B
            expect(mocked.document.create).not.toHaveBeenCalled();
            // Y el compare-and-set no debe haber consumido el doc
            expect(mocked.inboxDocument.updateMany).not.toHaveBeenCalled();
        });

        it('SÍ archiva cuando el QR y el doc son del mismo tenant (modo worker)', async () => {
            mocked.inboxDocument.findUnique.mockResolvedValue({
                id: 'doc-A',
                fileUrl: 'k',
                companyId: 'company-A',
                processed: false,
                originalName: 'x.pdf',
                content: null
            });
            mocked.employee.findUnique.mockResolvedValue({
                id: 'emp-A',
                companyId: 'company-A'
            });
            mocked.inboxDocument.updateMany.mockResolvedValue({ count: 1 });
            mocked.document.create.mockResolvedValue({ id: 'doc-new' });

            const result = await service.assignDocument(
                'doc-A',
                'emp-A',
                'Justificante',
                'Auto',
                undefined,
                null,
                { inboxDocCompanyId: 'company-A' }
            );
            expect(result).toMatchObject({ id: 'doc-new' });
            expect(mocked.document.create).toHaveBeenCalled();
        });
    });
});
