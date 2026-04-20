import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueService, QUEUES } from '../services/QueueService';
import { Worker, Queue } from 'bullmq';

// Mock BullMQ classes
vi.mock('bullmq', () => ({
    Queue: vi.fn().mockImplementation(() => ({
        add: vi.fn().mockResolvedValue({ id: 'job-123' }),
        getJobCounts: vi.fn().mockResolvedValue([0, 0, 0]),
        clean: vi.fn().mockResolvedValue(5),
        close: vi.fn().mockResolvedValue(undefined),
    })),
    Worker: vi.fn(),
    QueueEvents: vi.fn(),
    Job: vi.fn(),
}));

// Mock ioredis (connection is created at module load)
vi.mock('ioredis', () => {
    const mockRedis = {
        on: vi.fn(),
        disconnect: vi.fn(),
        connect: vi.fn(),
        ping: vi.fn().mockResolvedValue('PONG'),
    };
    return { Redis: vi.fn(() => mockRedis), RedisOptions: {} };
});

vi.mock('../../lib/prisma', () => ({
    prisma: {
        $connect: vi.fn().mockResolvedValue(undefined),
        $disconnect: vi.fn().mockResolvedValue(undefined),
        $transaction: vi.fn(),
    }
}));

describe('QueueService', () => {
    let queueService: any;

    beforeEach(() => {
        vi.clearAllMocks();
        // Re-initialize queues for each test
        queueService = new QueueService();
    });

    describe('Redis Connection Config', () => {
        it('should throw error in production if REDIS_HOST missing', () => {
            const originalEnv = process.env.NODE_ENV;
            const originalHost = process.env.REDIS_HOST;
            process.env.NODE_ENV = 'production';
            delete (process.env as any).REDIS_HOST;

            expect(() => new QueueService()).toThrow('REDIS_HOST or REDIS_URL must be defined');

            process.env.NODE_ENV = originalEnv;
            if (originalHost) process.env.REDIS_HOST = originalHost;
        });

        it('should use REDIS_URL if provided', () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            const svc = new QueueService();
            // Connection should be created with string URL
            expect(svс).toBeDefined();
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

    describe('addToIngestion', () => {
        it('should add job with data to ingestion queue', async () => {
            const result = await queueService.addToIngestion({ employeeId: 'emp-1', type: 'IMPORT' });
            expect(result).toHaveProperty('id');
        });
    });

    describe('addOcrJob', () => {
        it('should add OCR job with documentId', async () => {
            const result = await queueService.addOcrJob({ documentId: 'doc-123' });
            expect(result).toHaveProperty('id');
        });
    });

    describe('cleanOldJobs', () => {
        it('should clean completed jobs older than maxAge and return count', async () => {
            const cleaned = await queueService.cleanOldJobs('completed', 30);
            expect(cleaned).toBe(5);
        });
    });

    describe('close', () => {
        it('should close all queues and disconnect Redis', async () => {
            // Spying on connection disconnect
            const disconnectSpy = vi.spyOn(require('ioredis').Redis.prototype, 'disconnect');
            await queueService.close();
            expect(disconnectSpy).toHaveBeenCalled();
        });
    });
});
