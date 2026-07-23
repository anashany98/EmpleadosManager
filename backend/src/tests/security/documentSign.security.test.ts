// CRIT-004: Firma de documentos por ID arbitrario + path traversal.
//
// Vectores cubiertos:
//   A) sign cross-tenant: usuario de A firma un doc de B con solo el ID
//   B) sign huérfano: usuario de A firma un doc cuyo employee.companyId es null
//   C) path traversal en local: document.fileUrl contiene "../" y la
//      ruta resuelta sale de `uploads/`
//   D) data URL malformada o enorme que rompe pdf-lib
//   E) Storage getBuffer usado (no fs directo) + transacción compensable

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/prisma', () => {
    const document: any = {
        findUnique: vi.fn(),
        create: vi.fn()
    };
    return {
        prisma: {
            document,
            $transaction: vi.fn(async (fn: any) => fn({ document }))
        }
    };
});

// CRÍTICO: el servicio hace `import { StorageService } from '../StorageService'`,
// donde `..` desde `src/services/documents/` apunta a `src/services/`.
// Desde el test (en `src/tests/security/`) la ruta equivalente es
// `../../services/StorageService`. Hay que definir el mock INLINE
// porque vi.mock se eleva (hoist) antes que `const`.
vi.mock('../../services/StorageService', () => ({
    StorageService: {
        provider: 'local',
        saveBuffer: vi.fn(),
        getBuffer: vi.fn(),
        deleteFile: vi.fn()
    }
}));

const mockStorage = (await import('../../services/StorageService')).StorageService as {
    provider: string;
    saveBuffer: ReturnType<typeof vi.fn>;
    getBuffer: ReturnType<typeof vi.fn>;
    deleteFile: ReturnType<typeof vi.fn>;
};

vi.mock('fs', () => ({
    default: {
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        existsSync: vi.fn().mockReturnValue(true),
        mkdirSync: vi.fn(),
        unlinkSync: vi.fn()
    }
}));

vi.mock('../services/LoggerService', () => ({
    createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}));

vi.mock('../services/AuditService', () => ({
    AuditService: { log: vi.fn().mockResolvedValue(undefined) }
}));

// Mockeamos pdf-lib para no necesitar un PDF real en test
const mockEmbedPng = vi.fn().mockResolvedValue({ width: 100, height: 30 });
const mockDrawImage = vi.fn();
const mockGetPages = vi.fn().mockReturnValue([{ drawImage: mockDrawImage }]);
const mockSave = vi.fn().mockResolvedValue(new Uint8Array(Buffer.from('PDF_BINARY')));
const mockLoad = vi.fn().mockResolvedValue({
    embedPng: mockEmbedPng,
    getPages: mockGetPages,
    save: mockSave
});
vi.mock('pdf-lib', () => ({
    PDFDocument: { load: mockLoad }
}));

import { prisma } from '../../lib/prisma';
import { signDocument } from '../../services/documents/DocumentSignService';

const mocked = prisma as unknown as { document: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> } };

const ACTOR_A = { id: 'u-A', role: 'admin', companyId: 'company-A' };
const GLOBAL_ADMIN = { id: 'u-G', role: 'admin', companyId: null };

const VALID_PNG_DATAURL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('CRIT-004 — DocumentSignService tenant + path safety', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStorage.provider = 'local';
        mockStorage.saveBuffer.mockResolvedValue({ key: 'documents/EXP_1/signed.pdf' });
        mockStorage.getBuffer.mockResolvedValue(Buffer.from('%PDF-1.4 mocked'));
        mockStorage.deleteFile.mockResolvedValue(undefined);
        mocked.document.create.mockResolvedValue({ id: 'signed-doc' });
    });

    describe('A) autorización por tenant', () => {
        it('rechaza firmar un doc de company-B con un actor de A', async () => {
            mocked.document.findUnique.mockResolvedValue({
                id: 'doc-B',
                name: 'doc.pdf',
                fileUrl: 'docs/b.pdf',
                category: 'PRL',
                employeeId: 'emp-B',
                employee: { id: 'emp-B', companyId: 'company-B' }
            });
            await expect(
                signDocument('doc-B', VALID_PNG_DATAURL, ACTOR_A)
            ).rejects.toThrow(/no encontrad|otro tenant|forbidden|not found/i);
            expect(mocked.document.create).not.toHaveBeenCalled();
        });

        it('rechaza firmar un doc con employee.companyId:null desde un actor de tenant', async () => {
            mocked.document.findUnique.mockResolvedValue({
                id: 'doc-null',
                name: 'doc.pdf',
                fileUrl: 'docs/n.pdf',
                category: 'PRL',
                employeeId: 'emp-null',
                employee: { id: 'emp-null', companyId: null }
            });
            await expect(
                signDocument('doc-null', VALID_PNG_DATAURL, ACTOR_A)
            ).rejects.toThrow(/no encontrad|sin empresa|otro tenant|forbidden|not found/i);
            expect(mocked.document.create).not.toHaveBeenCalled();
        });

        it('permite firmar un doc de A desde un actor de A', async () => {
            mocked.document.findUnique.mockResolvedValue({
                id: 'doc-A',
                name: 'doc.pdf',
                fileUrl: 'documents/EXP_emp-A/doc.pdf',
                category: 'PRL',
                employeeId: 'emp-A',
                expiryDate: null,
                employee: { id: 'emp-A', companyId: 'company-A' }
            });
            const result = await signDocument('doc-A', VALID_PNG_DATAURL, ACTOR_A);
            expect(result).toMatchObject({ id: 'signed-doc' });
            expect(mocked.document.create).toHaveBeenCalled();
        });

        it('admin global puede firmar cualquier doc', async () => {
            mocked.document.findUnique.mockResolvedValue({
                id: 'doc-B',
                name: 'doc.pdf',
                fileUrl: 'docs/b.pdf',
                category: 'PRL',
                employeeId: 'emp-B',
                expiryDate: null,
                employee: { id: 'emp-B', companyId: 'company-B' }
            });
            const result = await signDocument('doc-B', VALID_PNG_DATAURL, GLOBAL_ADMIN);
            expect(result).toMatchObject({ id: 'signed-doc' });
        });
    });

    describe('B/C) path traversal y lectura segura', () => {
        it('NO usa fs.readFileSync directo: usa StorageService.getBuffer', async () => {
            const fs = await import('fs');
            mocked.document.findUnique.mockResolvedValue({
                id: 'doc-A',
                name: 'doc.pdf',
                fileUrl: 'documents/EXP_emp-A/doc.pdf',
                category: 'PRL',
                employeeId: 'emp-A',
                employee: { id: 'emp-A', companyId: 'company-A' }
            });
            await signDocument('doc-A', VALID_PNG_DATAURL, ACTOR_A);
            // El servicio debe usar StorageService.getBuffer, no fs directo
            expect(fs.default.readFileSync).not.toHaveBeenCalled();
            expect(mockStorage.getBuffer).toHaveBeenCalledWith('documents/EXP_emp-A/doc.pdf');
        });

        it('rechaza fileUrl con path traversal (../)', async () => {
            mocked.document.findUnique.mockResolvedValue({
                id: 'doc-A',
                name: 'doc.pdf',
                fileUrl: '../../../etc/passwd',
                category: 'PRL',
                employeeId: 'emp-A',
                employee: { id: 'emp-A', companyId: 'company-A' }
            });
            await expect(
                signDocument('doc-A', VALID_PNG_DATAURL, ACTOR_A)
            ).rejects.toThrow(/clave|path|invalid|segura|traversal|seguro|namespace/i);
            expect(mockStorage.getBuffer).not.toHaveBeenCalled();
            expect(mocked.document.create).not.toHaveBeenCalled();
        });

        it('rechaza fileUrl absoluta que intenta salir del namespace', async () => {
            mocked.document.findUnique.mockResolvedValue({
                id: 'doc-A',
                name: 'doc.pdf',
                fileUrl: '/etc/passwd',
                category: 'PRL',
                employeeId: 'emp-A',
                employee: { id: 'emp-A', companyId: 'company-A' }
            });
            await expect(
                signDocument('doc-A', VALID_PNG_DATAURL, ACTOR_A)
            ).rejects.toThrow(/clave|path|invalid|segura|traversal|seguro|namespace/i);
            expect(mockStorage.getBuffer).not.toHaveBeenCalled();
        });
    });

    describe('D) validación de la data URL de la firma', () => {
        it('rechaza data URL que no es image/png', async () => {
            mocked.document.findUnique.mockResolvedValue({
                id: 'doc-A',
                name: 'doc.pdf',
                fileUrl: 'documents/EXP_emp-A/doc.pdf',
                category: 'PRL',
                employeeId: 'emp-A',
                employee: { id: 'emp-A', companyId: 'company-A' }
            });
            const svgDataUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';
            await expect(
                signDocument('doc-A', svgDataUrl, ACTOR_A)
            ).rejects.toThrow(/png|image|format/i);
            expect(mockEmbedPng).not.toHaveBeenCalled();
        });

        it('rechaza data URL demasiado grande (>2MB decodificado)', async () => {
            mocked.document.findUnique.mockResolvedValue({
                id: 'doc-A',
                name: 'doc.pdf',
                fileUrl: 'documents/EXP_emp-A/doc.pdf',
                category: 'PRL',
                employeeId: 'emp-A',
                employee: { id: 'emp-A', companyId: 'company-A' }
            });
            // 3MB de base64 → > 2MB binario
            const bigBase64 = 'A'.repeat(3 * 1024 * 1024);
            const bigDataUrl = `data:image/png;base64,${bigBase64}`;
            await expect(
                signDocument('doc-A', bigDataUrl, ACTOR_A)
            ).rejects.toThrow(/tamañ|size|grande|limit|exced/i);
            expect(mockEmbedPng).not.toHaveBeenCalled();
        });

        it('rechaza data URL malformada', async () => {
            mocked.document.findUnique.mockResolvedValue({
                id: 'doc-A',
                name: 'doc.pdf',
                fileUrl: 'documents/EXP_emp-A/doc.pdf',
                category: 'PRL',
                employeeId: 'emp-A',
                employee: { id: 'emp-A', companyId: 'company-A' }
            });
            await expect(
                signDocument('doc-A', 'not-a-data-url', ACTOR_A)
            ).rejects.toThrow(/formato|png|invalid/i);
            expect(mockEmbedPng).not.toHaveBeenCalled();
        });
    });

    describe('E) audit y rollback', () => {
        it('hace rollback del storage si falla la creación del Document firmado', async () => {
            mocked.document.findUnique.mockResolvedValue({
                id: 'doc-A',
                name: 'doc.pdf',
                fileUrl: 'documents/EXP_emp-A/doc.pdf',
                category: 'PRL',
                employeeId: 'emp-A',
                employee: { id: 'emp-A', companyId: 'company-A' }
            });
            mockStorage.saveBuffer.mockResolvedValue({ key: 'documents/EXP_emp-A/signed.pdf' });
            mocked.document.create.mockRejectedValue(new Error('DB down'));
            await expect(
                signDocument('doc-A', VALID_PNG_DATAURL, ACTOR_A)
            ).rejects.toThrow(/DB down/);
            // El storage debe haber recibido la orden de borrar el fichero firmado
            expect(mockStorage.deleteFile).toHaveBeenCalledWith('documents/EXP_emp-A/signed.pdf');
        });
    });
});
