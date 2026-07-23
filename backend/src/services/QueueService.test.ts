import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so the mock function is available when vi.mock factories run (they are hoisted)
const { mockDisconnect } = vi.hoisted(() => ({
    mockDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('ioredis', () => {
    const mockRedis = {
        on: vi.fn(),
        disconnect: mockDisconnect,
        connect: vi.fn(),
        ping: vi.fn().mockResolvedValue('PONG'),
    };
    const Redis = vi.fn(function Redis() {
        return mockRedis;
    });
    return { default: Redis, Redis, RedisOptions: {} };
});

vi.mock('../../lib/prisma', () => ({
    prisma: {
        $connect: vi.fn().mockResolvedValue(undefined),
        $disconnect: vi.fn().mockResolvedValue(undefined),
        $transaction: vi.fn(),
    }
}));

// Mock bullmq
vi.mock('bullmq', () => ({
    Queue: vi.fn(function Queue() {
        return {
            add: vi.fn().mockResolvedValue({ id: 'job-123' }),
            getJobCounts: vi.fn().mockResolvedValue([0, 0, 0]),
            clean: vi.fn().mockResolvedValue(5),
            close: vi.fn().mockResolvedValue(undefined),
        };
    }),
    Worker: vi.fn(function Worker() {
        return { close: vi.fn().mockResolvedValue(undefined) };
    }),
    QueueEvents: vi.fn(function QueueEvents() {
        return { close: vi.fn().mockResolvedValue(undefined) };
    }),
    Job: vi.fn(),
}));

import { QueueService, QUEUES } from '../services/QueueService';

describe('QueueService', () => {
    let queueService: any;

    beforeEach(() => {
        vi.clearAllMocks();
        // El setup de tests pone REDIS_MOCK=true por defecto, lo que
        // hace que QueueService no inicialice BullMQ. Para este
        // test específico, forzar el modo BullMQ activo.
        process.env.REDIS_MOCK = 'false';
        // Re-initialize queues for each test
        queueService = new QueueService();
    });

    describe('Redis Connection Config', () => {
        it('should construct queues with the module-level Redis connection', () => {
            const originalEnv = process.env.NODE_ENV;
            const originalHost = process.env.REDIS_HOST;
            process.env.NODE_ENV = 'production';
            delete (process.env as any).REDIS_HOST;

            expect(() => new QueueService()).not.toThrow();

            process.env.NODE_ENV = originalEnv;
            if (originalHost) process.env.REDIS_HOST = originalHost;
        });

        it('should use REDIS_URL if provided', () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            const svc = new QueueService();
            // Connection should be created with string URL
            expect(svc).toBeDefined();
        });
    });

    describe('Queue Definitions', () => {
        it('should define INGESTION and OCR queue names', () => {
            expect(QUEUES.INGESTION).toBe('ingestion-queue');
            expect(QUEUES.OCR).toBe('ocr-queue');
        });
    });

    describe('getQueue', () => {
        it('should return a Queue instance', () => {
            const queue = queueService.getQueue('ingestion-queue');
            expect(queue).toBeDefined();
            expect(queue.add).toBeDefined();
        });

        it('should cache queues (same instance on repeated calls)', () => {
            const q1 = queueService.getQueue('ingestion-queue');
            const q2 = queueService.getQueue('ingestion-queue');
            expect(q1).toBe(q2);
        });

        it('should return undefined for unknown queue', () => {
            const q = queueService.getQueue('unknown-queue' as any);
            expect(q).toBeUndefined();
        });
    });

    describe('addJob', () => {
        it('should add job with data to ingestion queue', async () => {
            const result = await queueService.addJob(QUEUES.INGESTION, 'import-employee', { employeeId: 'emp-1', type: 'IMPORT' });
            expect(result).toHaveProperty('id');
        });

        it('should add OCR job with documentId', async () => {
            const result = await queueService.addJob(QUEUES.OCR, 'ocr-document', { documentId: 'doc-123' });
            expect(result).toHaveProperty('id');
        });

        it('should throw for unknown queue', async () => {
            await expect(queueService.addJob('unknown-queue', 'job', {})).rejects.toThrow('Queue unknown-queue not found');
        });
    });

    describe('close', () => {
        it('should close all queues and close the Redis connection when supported', async () => {
            await expect(queueService.close()).resolves.toBeUndefined();
        });
    });
});
