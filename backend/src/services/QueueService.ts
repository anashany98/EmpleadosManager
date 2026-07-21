import { Queue, Worker, QueueEvents, Job, WorkerOptions } from 'bullmq';
import { redis as connection } from '../config/redis';
import { createLogger } from './LoggerService';

const log = createLogger('QueueService');

export const QUEUES = {
    INGESTION: 'ingestion-queue',
    OCR: 'ocr-queue',
    PAYROLL_GENERATION: 'payroll-generation-queue',
};

/**
 * Default worker options tuned for production resilience:
 * - bounded `removeOnComplete` / `removeOnFailed` to prevent unbounded
 *   memory growth in Redis
 * - explicit `connection` so BullMQ does not create extra sockets
 *
 * NOTE: backoff is configured at the queue/job level (in addJob), not
 * at the worker level, because BullMQ retries are a queue-level concern.
 */
const DEFAULT_WORKER_OPTS: Partial<WorkerOptions> = {
    connection,
    removeOnComplete: {
        count: 1000,
        age: 24 * 60 * 60 // 24h
    },
    removeOnFail: {
        count: 5000,
        age: 7 * 24 * 60 * 60 // 7 days, then can be inspected/cleaned
    }
};

export class QueueService {
    private queues: Record<string, Queue> = {};
    private workers: Record<string, Worker> = {};
    private queueEvents: Record<string, QueueEvents> = {};
    private readonly enabled: boolean;

    constructor() {
        // Cuando REDIS_MOCK=true (suite de tests), no inicializamos
        // BullMQ: MockRedis no es un IORedis y BullMQ intentaría
        // conectar a localhost:6379, reventando la suite con
        // ECONNREFUSED. Los tests de MED-001 ya no dependen de
        // BullMQ para verificar el rate limit; los tests que sí
        // (QueueService.test.ts) mockean ioredis directamente.
        this.enabled = process.env.REDIS_MOCK !== 'true';
        if (this.enabled) {
            this.initQueues();
        } else {
            log.info('QueueService disabled (REDIS_MOCK=true)');
        }
    }

    private initQueues() {
        Object.values(QUEUES).forEach((queueName) => {
            this.queues[queueName] = new Queue(queueName, { connection });
            this.queueEvents[queueName] = new QueueEvents(queueName, { connection });
            log.info(`Queue initialized: ${queueName}`);
        });
    }

    public getQueue(queueName: string): Queue {
        return this.queues[queueName];
    }

    public async addJob(queueName: string, jobName: string, data: any, opts?: any) {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        // Default to 3 attempts with exponential backoff for jobs that
        // do not specify their own retry policy. Hard-fail after that so
        // the job is visible in the dead-letter set (removeOnFailed keeps
        // it for 7 days).
        const finalOpts = {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 1000,
            removeOnFailed: 5000,
            ...opts
        };
        return queue.add(jobName, data, finalOpts);
    }

    public registerWorker(
        queueName: string,
        processor: (job: Job) => Promise<any>,
        concurrency = 1,
        extraOpts: Partial<WorkerOptions> = {}
    ) {
        if (this.workers[queueName]) {
            log.warn(`Worker for ${queueName} already registered`);
            return;
        }

        // `backoff` is part of the queue-level `Job` retry options, not
        // the worker's connection options. The default retry policy
        // (set when adding jobs) provides exponential backoff. If a
        // caller needs to override the per-job backoff they can do so
        // when calling `addJob`. The worker's own options are scoped
        // to runtime concerns (concurrency, limiter, removeOnX).
        const opts: WorkerOptions = {
            ...DEFAULT_WORKER_OPTS,
            ...extraOpts,
            concurrency
        } as WorkerOptions;

        const worker = new Worker(queueName, processor, opts);

        worker.on('completed', (job) => {
            log.info({ jobId: job.id, attempts: job.attemptsMade }, `Job completed in ${queueName}`);
        });

        worker.on('failed', (job, err) => {
            log.error(
                {
                    jobId: job?.id,
                    attempts: job?.attemptsMade,
                    maxAttempts: job?.opts?.attempts,
                    err
                },
                `Job failed in ${queueName}${job?.attemptsMade === job?.opts?.attempts ? ' (DEAD LETTER)' : ''}`
            );
        });

        worker.on('error', (err) => {
            log.error({ err }, `Worker error in ${queueName}`);
        });

        this.workers[queueName] = worker;
        log.info(`Worker registered for ${queueName} with concurrency ${concurrency}`);
    }

    public async close() {
        await Promise.all(Object.values(this.queues).map(q => q.close()));
        await Promise.all(Object.values(this.workers).map(w => w.close()));
        await Promise.all(Object.values(this.queueEvents).map(e => e.close()));

        const redisConnection = connection as unknown as {
            disconnect?: () => void;
            quit?: () => Promise<unknown> | unknown;
        };

        if (typeof redisConnection.disconnect === 'function') {
            redisConnection.disconnect();
        } else if (typeof redisConnection.quit === 'function') {
            await redisConnection.quit();
        }

        log.info('QueueService closed');
    }
}

export const queueService = new QueueService();
