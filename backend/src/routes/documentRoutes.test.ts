import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import documentRoutes from './documentRoutes';
import { errorMiddleware } from '../middlewares/errorMiddleware';
import { prisma } from '../lib/prisma';
import { DocumentTemplateService } from '../services/DocumentTemplateService';

vi.mock('../lib/prisma', () => ({
    prisma: {
        employee: {
            findUnique: vi.fn()
        },
        document: {
            findUnique: vi.fn()
        }
    }
}));

vi.mock('../services/DocumentTemplateService', () => ({
    DocumentTemplateService: {
        generateUniform: vi.fn(),
        generateEPI: vi.fn(),
        generateTechDevice: vi.fn(),
        generateModel145: vi.fn(),
        generateNDA: vi.fn(),
        generateRGPD: vi.fn()
    }
}));

vi.mock('../controllers/DocumentController', () => ({
    DocumentController: {
        upload: vi.fn(),
        processOCR: vi.fn(),
        getByEmployee: vi.fn(),
        download: vi.fn(),
        delete: vi.fn()
    }
}));

vi.mock('../services/LoggerService', () => ({
    createLogger: () => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    })
}));

function createApp(user: Record<string, unknown>) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        (req as any).user = user;
        next();
    });
    app.use('/api/documents', documentRoutes);
    app.use(errorMiddleware);
    return app;
}

describe('documentRoutes generate endpoints', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('blocks company admins from generating documents for another company', async () => {
        vi.mocked(prisma.employee.findUnique).mockResolvedValue({
            id: 'emp-2',
            companyId: 'company-2'
        } as never);
        vi.mocked(DocumentTemplateService.generateUniform).mockResolvedValue({
            id: 'doc-forbidden',
            name: 'Entrega Uniforme'
        } as never);

        const app = createApp({
            id: 'user-1',
            role: 'admin',
            companyId: 'company-1',
            permissions: { documents: 'write' }
        });

        const res = await request(app)
            .post('/api/documents/generate-uniform')
            .send({ employeeId: 'emp-2', items: [] });

        expect(res.status).toBe(403);
        expect(DocumentTemplateService.generateUniform).not.toHaveBeenCalled();
    });

    it('allows global admins to generate documents across companies', async () => {
        vi.mocked(prisma.employee.findUnique).mockResolvedValue({
            id: 'emp-2',
            companyId: 'company-2'
        } as never);
        vi.mocked(DocumentTemplateService.generateUniform).mockResolvedValue({
            id: 'doc-1',
            name: 'Entrega Uniforme'
        } as never);

        const app = createApp({
            id: 'user-1',
            role: 'admin',
            permissions: { documents: 'write' }
        });

        const res = await request(app)
            .post('/api/documents/generate-uniform')
            .send({ employeeId: 'emp-2', items: [] });

        expect(res.status).toBe(200);
        expect(DocumentTemplateService.generateUniform).toHaveBeenCalledWith('emp-2', [], 'Administrador');
    });
});
