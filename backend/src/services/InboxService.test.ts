import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as chokidar from 'chokidar';
import { InboxService } from './InboxService';
import { prisma } from '../lib/prisma';
import { QUEUES, queueService } from './QueueService';

vi.mock('../lib/prisma', () => ({
    prisma: {
        inboxDocument: {
            findUnique: vi.fn(),
            update: vi.fn()
        },
        document: {
            create: vi.fn()
        },
        configuration: {
            findUnique: vi.fn()
        },
        fileMapping: {
            count: vi.fn(),
            createMany: vi.fn()
        }
    }
}));

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn().mockReturnValue(true),
        mkdirSync: vi.fn(),
        readdirSync: vi.fn().mockReturnValue([]),
        statSync: vi.fn().mockReturnValue({ isDirectory: () => false }),
        writeFileSync: vi.fn()
    }
}));

vi.mock('chokidar', () => ({
    watch: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        close: vi.fn()
    })
}));

vi.mock('./QueueService', () => ({
    QUEUES: {
        INGESTION: 'ingestion-queue'
    },
    queueService: {
        addJob: vi.fn().mockResolvedValue(undefined)
    }
}));

describe('InboxService', () => {
    let service: InboxService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.configuration.findUnique).mockResolvedValue(null as never);
        vi.mocked(prisma.fileMapping.count).mockResolvedValue(1 as never);
        service = new InboxService();
    });

    it('starts the watcher on start()', () => {
        service.start();
        expect(chokidar.watch).toHaveBeenCalled();
    });

    it('enqueues a new file for asynchronous ingestion', async () => {
        const filePath = path.join(process.cwd(), 'data/inbox/test.pdf');

        await service.processFile(filePath);

        expect(queueService.addJob).toHaveBeenCalledWith(
            QUEUES.INGESTION,
            'process-file',
            { filePath },
            expect.objectContaining({
                removeOnComplete: true,
                removeOnFail: 100
            })
        );
    });

    it('assigns a pending inbox document to the employee archive', async () => {
        vi.mocked(prisma.inboxDocument.findUnique).mockResolvedValue({
            id: 'inbox-1',
            originalName: 'test.pdf',
            fileUrl: 'mock-s3-key',
            content: 'contenido OCR',
            processed: false
        } as never);
        vi.mocked(prisma.document.create).mockResolvedValue({ id: 'doc-1' } as never);
        vi.mocked(prisma.inboxDocument.update).mockResolvedValue({ id: 'inbox-1', processed: true } as never);

        const result = await service.assignDocument('inbox-1', 'emp-123', 'Justificante Ausencia', 'Documento Auto 2026-03-13');

        expect(prisma.document.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                employeeId: 'emp-123',
                category: 'Justificante Ausencia',
                fileUrl: 'mock-s3-key'
            })
        }));
        expect(prisma.inboxDocument.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'inbox-1' },
            data: expect.objectContaining({ processed: true })
        }));
        expect(result).toEqual({ id: 'doc-1' });
    });
});
