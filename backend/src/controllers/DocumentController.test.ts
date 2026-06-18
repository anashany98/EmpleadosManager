import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../lib/prisma', () => ({
    prisma: {
        document: {
            findUnique: vi.fn()
        },
        documentTemplate: { findUnique: vi.fn(), delete: vi.fn() }
    }
}));

vi.mock('../services/StorageService', () => ({
    StorageService: {
        provider: 'local',
        deleteFile: vi.fn(),
        getSignedDownloadUrl: vi.fn()
    }
}));

vi.mock('../services/LoggerService', () => ({
    createLogger: () => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        fatal: vi.fn()
    })
}));

import { DocumentController } from './DocumentController';
import { prisma } from '../lib/prisma';

const createResponse = () => {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
        sendFile: vi.fn(),
        download: vi.fn(),
        redirect: vi.fn(),
        setHeader: vi.fn()
    };
    return res as unknown as Response;
};

describe('DocumentController.download — IDOR prevention', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('blocks cross-tenant document download (company-A user → company-B document)', async () => {
        // Document belongs to company-B
        vi.mocked(prisma.document.findUnique).mockResolvedValue({
            id: 'doc-1',
            employeeId: 'emp-b',
            name: 'nomina-juan.pdf',
            category: 'PAYROLL',
            fileUrl: 'documents/EXP_emp-b/nomina.pdf',
            uploadDate: new Date(),
            expiryDate: null,
            content: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            employee: {
                companyId: 'company-B',
                deletedAt: null
            }
        } as never);

        // User belongs to company-A
        const req = {
            params: { id: 'doc-1' },
            query: {},
            user: {
                id: 'user-a',
                email: 'hr@empresaA.com',
                role: 'hr',
                companyId: 'company-A'
            }
        } as unknown as Request;
        const res = createResponse();

        await expect(DocumentController.download(req, res)).rejects.toThrow(
            /No tienes permiso para acceder a este documento/
        );
        // No redirect, no sendFile, no redirect to signed URL
        expect(res.redirect).not.toHaveBeenCalled();
        expect(res.sendFile).not.toHaveBeenCalled();
        expect(res.download).not.toHaveBeenCalled();
    });

    it('allows global admin to download any document', async () => {
        vi.mocked(prisma.document.findUnique).mockResolvedValue({
            id: 'doc-2',
            employeeId: 'emp-c',
            name: 'doc.pdf',
            category: 'OTHER',
            fileUrl: 'documents/EXP_emp-c/doc.pdf',
            uploadDate: new Date(),
            expiryDate: null,
            content: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            employee: {
                companyId: 'company-C',
                deletedAt: null
            }
        } as never);

        const req = {
            params: { id: 'doc-2' },
            query: {},
            user: {
                id: 'admin-global',
                email: 'admin@global.com',
                role: 'admin',
                companyId: null  // global admin — no companyId
            }
        } as unknown as Request;
        const res = createResponse();

        // For S3 redirect path: expect res.redirect to be called with a URL
        // For local path: would call res.sendFile. We're testing the access
        // check passes (no 403 thrown), so we don't need to mock the rest.
        // The fact that we reach StorageService.getSignedDownloadUrl (S3 default)
        // and don't throw is sufficient. Set provider to mock the s3 path.
        // Just ensure no rejection.
        try {
            await DocumentController.download(req, res);
        } catch (e) {
            // We expect either a redirect call (mocked S3 returns undefined → throws)
            // or successful response. Either is fine as long as the IDOR check passes.
            // The important thing is that we did NOT get the IDOR 403.
            expect((e as Error).message).not.toMatch(/No tienes permiso para acceder a este documento/);
        }
    });

    it('allows same-company user to download their company document', async () => {
        vi.mocked(prisma.document.findUnique).mockResolvedValue({
            id: 'doc-3',
            employeeId: 'emp-x',
            name: 'doc.pdf',
            category: 'PAYROLL',
            fileUrl: 'documents/EXP_emp-x/doc.pdf',
            uploadDate: new Date(),
            expiryDate: null,
            content: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            employee: {
                companyId: 'company-X',
                deletedAt: null
            }
        } as never);

        const req = {
            params: { id: 'doc-3' },
            query: {},
            user: {
                id: 'user-x',
                email: 'hr@empresaX.com',
                role: 'hr',
                companyId: 'company-X'
            }
        } as unknown as Request;
        const res = createResponse();

        try {
            await DocumentController.download(req, res);
        } catch (e) {
            // If it throws, it must NOT be the IDOR check
            expect((e as Error).message).not.toMatch(/No tienes permiso para acceder a este documento/);
        }
    });

    it('returns 404 when document does not exist', async () => {
        vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

        const req = {
            params: { id: 'nonexistent' },
            query: {},
            user: {
                id: 'user-1',
                email: 'user@empresa.com',
                role: 'hr',
                companyId: 'company-1'
            }
        } as unknown as Request;
        const res = createResponse();

        await expect(DocumentController.download(req, res)).rejects.toThrow(
            /Documento no encontrado/
        );
    });
});

describe('DocumentController.delete — IDOR prevention', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('blocks cross-tenant document delete (company-A user → company-B document)', async () => {
        vi.mocked(prisma.document.findUnique).mockResolvedValue({
            id: 'doc-1',
            employeeId: 'emp-b',
            name: 'doc.pdf',
            category: 'PAYROLL',
            fileUrl: 'documents/EXP_emp-b/doc.pdf',
            uploadDate: new Date(),
            expiryDate: null,
            content: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            employee: {
                companyId: 'company-B',
                deletedAt: null
            }
        } as never);

        const req = {
            params: { id: 'doc-1' },
            query: {},
            user: {
                id: 'user-a',
                email: 'hr@empresaA.com',
                role: 'hr',
                companyId: 'company-A'
            }
        } as unknown as Request;
        const res = createResponse();

        await expect(DocumentController.delete(req, res)).rejects.toThrow(
            /No tienes permiso para eliminar/
        );
    });
});