import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import mappingProfileRoutes from './mappingProfileRoutes';
import { errorMiddleware } from '../middlewares/errorMiddleware';
import { prisma } from '../lib/prisma';

const {
    mockGetProfiles,
    mockCreateProfile,
    mockDeleteProfile,
    mockGetFileMappings,
    mockCreateFileMapping,
    mockUpdateFileMapping,
    mockDeleteFileMapping
} = vi.hoisted(() => ({
    mockGetProfiles: vi.fn((_req, res) => res.status(200).json([])),
    mockCreateProfile: vi.fn((_req, res) => res.status(201).json({ id: 'profile-1' })),
    mockDeleteProfile: vi.fn((_req, res) => res.status(200).json({ deleted: true })),
    mockGetFileMappings: vi.fn((_req, res) => res.status(200).json([])),
    mockCreateFileMapping: vi.fn((_req, res) => res.status(201).json({ id: 'fm-1' })),
    mockUpdateFileMapping: vi.fn((_req, res) => res.status(200).json({ updated: true })),
    mockDeleteFileMapping: vi.fn((_req, res) => res.status(200).json({ deleted: true }))
}));

vi.mock('../controllers/MappingProfileController', () => ({
    MappingProfileController: class {
        getProfiles = mockGetProfiles;
        createProfile = mockCreateProfile;
        deleteProfile = mockDeleteProfile;
    }
}));

vi.mock('../controllers/FileMappingController', () => ({
    FileMappingController: {
        getAll: mockGetFileMappings,
        create: mockCreateFileMapping,
        update: mockUpdateFileMapping,
        delete: mockDeleteFileMapping
    }
}));

vi.mock('../lib/prisma', () => ({
    prisma: {
        fileMapping: {
            findUnique: vi.fn()
        },
        mappingProfile: {
            findUnique: vi.fn()
        }
    }
}));

function createApp(user: Record<string, unknown>) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        (req as any).user = user;
        next();
    });
    app.use('/api/mappings', mappingProfileRoutes);
    app.use(errorMiddleware);
    return app;
}

describe('mappingProfileRoutes authorization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('allows global admins to manage mapping profiles', async () => {
        const app = createApp({
            id: 'user-global-admin',
            role: 'admin',
            permissions: { payroll: 'write' }
        });

        const res = await request(app)
            .post('/api/mappings')
            .send({ name: 'New Profile', rules: { column1: 'fieldA' } });

        expect(res.status).toBe(201);
        expect(mockCreateProfile).toHaveBeenCalled();
    });

    it('blocks company staff from managing global mapping profiles', async () => {
        const app = createApp({
            id: 'user-hr',
            role: 'hr',
            companyId: 'company-1',
            permissions: { payroll: 'write' }
        });

        const res = await request(app)
            .post('/api/mappings')
            .send({ name: 'Company Profile', rules: { column1: 'fieldB' } });

        expect(res.status).toBe(403);
        expect(mockCreateProfile).not.toHaveBeenCalled();
    });

    it('allows company staff to view file mappings', async () => {
        const app = createApp({
            id: 'user-hr',
            role: 'hr',
            companyId: 'company-1',
            permissions: { payroll: 'write' }
        });

        const res = await request(app).get('/api/mappings/file-mappings');

        expect(res.status).toBe(200);
    });

    it('allows global admins to create file mappings with no company', async () => {
        const app = createApp({
            id: 'user-global-admin',
            role: 'admin',
            permissions: { payroll: 'write' }
        });

        const res = await request(app)
            .post('/api/mappings/file-mappings')
            .send({ qrType: 'VACATION', category: 'Justificante', namePattern: 'Justificante {{date}}' });

        expect(res.status).toBe(201);
    });
});