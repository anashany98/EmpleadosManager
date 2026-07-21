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
            findFirst: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn()
        },
        document: {
            create: vi.fn()
        },
        employee: {
            findUnique: vi.fn()
        },
        configuration: {
            findUnique: vi.fn()
        },
        fileMapping: {
            count: vi.fn(),
            createMany: vi.fn()
        },
        $transaction: vi.fn(async (callback) => callback({
            document: {
                create: vi.fn((args) => prisma.document.create(args))
            },
            inboxDocument: {
                update: vi.fn((args) => prisma.inboxDocument.update(args)),
                updateMany: vi.fn((args) => prisma.inboxDocument.updateMany(args))
            }
        }))
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
            expect.objectContaining({ filePath }),
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
            companyId: 'company-A',
            processed: false
        } as never);
        vi.mocked(prisma.employee.findUnique).mockResolvedValue({
            id: 'emp-123',
            companyId: 'company-A'
        } as never);
        vi.mocked(prisma.inboxDocument.updateMany).mockResolvedValue({ count: 1 } as never);
        vi.mocked(prisma.document.create).mockResolvedValue({ id: 'doc-1' } as never);

        const result = await service.assignDocument(
            'inbox-1',
            'emp-123',
            'Justificante Ausencia',
            'Documento Auto 2026-03-13',
            undefined,
            { id: 'u-1', role: 'admin', companyId: 'company-A' }
        );

        expect(prisma.document.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                employeeId: 'emp-123',
                category: 'Justificante Ausencia',
                fileUrl: 'mock-s3-key'
            })
        }));
        expect(prisma.inboxDocument.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'inbox-1', processed: false },
            data: expect.objectContaining({ processed: true })
        }));
        expect(result).toEqual({ id: 'doc-1' });
    });
});
