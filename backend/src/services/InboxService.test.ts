import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InboxService } from './InboxService';
import { prisma } from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import * as chokidar from 'chokidar';

// Mocks
vi.mock('../lib/prisma', () => ({
    prisma: {
        inboxDocument: {
            findFirst: vi.fn(),
            create: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        document: {
            create: vi.fn(),
        },
        configuration: {
            findUnique: vi.fn(),
        }
    }
}));

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn().mockReturnValue(true),
        mkdirSync: vi.fn(),
        readdirSync: vi.fn().mockReturnValue([]),
        statSync: vi.fn().mockReturnValue({ isDirectory: () => false }),
        readFileSync: vi.fn().mockReturnValue(Buffer.from('mock-content')),
        writeFileSync: vi.fn(),
        renameSync: vi.fn(),
        unlinkSync: vi.fn(),
    }
}));

vi.mock('chokidar', () => ({
    watch: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        close: vi.fn(),
    })
}));

vi.mock('./StorageService', () => ({
    StorageService: {
        saveBuffer: vi.fn().mockResolvedValue({ key: 'mock-s3-key' }),
        provider: 'local'
    }
}));

vi.mock('./NotificationService', () => ({
    NotificationService: {
        notifyAdmins: vi.fn(),
    }
}));

// Mock pdf-lib to avoid complex parsing in unit test
vi.mock('pdf-lib', () => ({
    PDFDocument: {
        load: vi.fn().mockResolvedValue({
            getSubject: vi.fn().mockReturnValue(JSON.stringify({
                t: 'VACATION',
                eid: 'emp-123',
                d: '2023-10-27T10:00:00.000Z'
            }))
        })
    }
}));

describe('InboxService', () => {
    let service: InboxService;

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset singleton if possible or just new instance?
        // Classes are exported, so new instance is fine.
        service = new InboxService();
    });

    it('should start watcher on start()', () => {
        service.start();
        expect(chokidar.watch).toHaveBeenCalled();
    });

    it('should process new file and detect QR/Metadata', async () => {
        const filePath = path.join(process.cwd(), 'data/inbox/test.pdf');

        // Mock DB: file not exists
        (prisma.inboxDocument.findFirst as any).mockResolvedValue(null);
        // Mock creation
        (prisma.inboxDocument.create as any).mockResolvedValue({ id: 'inbox-1', originalName: 'test.pdf', fileUrl: 'mock-s3-key' });
        // Mock findUnique for assignment
        (prisma.inboxDocument.findUnique as any).mockResolvedValue({ id: 'inbox-1', fileUrl: 'mock-s3-key', processed: false });

        await service.processFile(filePath);

        expect(prisma.inboxDocument.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ filename: 'test.pdf', source: 'SCANNER' })
        }));

        // Auto-assign should happen because we mocked PDF metadata
        expect(prisma.document.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                employeeId: 'emp-123',
                category: 'Justificante Ausencia'
            })
        }));

        expect(prisma.inboxDocument.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'inbox-1' },
            data: expect.objectContaining({ processed: true })
        }));
    });

    it('should skip file if already in DB', async () => {
        const filePath = path.join(process.cwd(), 'data/inbox/duplicate.pdf');
        (prisma.inboxDocument.findFirst as any).mockResolvedValue({ id: 'existing' });

        await service.processFile(filePath);

        expect(prisma.inboxDocument.create).not.toHaveBeenCalled();
    });
});
