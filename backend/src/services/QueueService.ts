import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis, { type RedisOptions } from 'ioredis';
import { createLogger } from './LoggerService';

const log = createLogger('QueueService');

function buildRedisConfig(): string | RedisOptions {
    const redisUrl = process.env.REDIS_URL;
    
    if (redisUrl) {
        log.info('Using REDIS_URL for connection');
        return redisUrl;
    }

    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379');
    const password = process.env.REDIS_PASSWORD;

    const config: RedisOptions = {
        host,
        port,
        maxRetriesPerRequest: null,
    };

    if (password) {
        config.password = password;
        log.info(`Connecting to Redis at ${host}:${port} with password`);
    } else {
        log.info(`Connecting to Redis at ${host}:${port} (no password)`);
    }

    return config;
}

const redisConfig = buildRedisConfig();
export const connection = typeof redisConfig === 'string'
    ? new IORedis(redisConfig)
    : new IORedis(redisConfig);

connection.on('connect', () => {
    log.info('Redis connected successfully');
});

connection.on('error', (err) => {
    log.error({ err }, 'Redis connection error');
});

connection.on('ready', () => {
    log.info('Redis ready');
});

export const QUEUES = {
    INGESTION: 'ingestion-queue',
    OCR: 'ocr-queue',
};

class QueueService {
    private queues: Record<string, Queue> = {};
    private workers: Record<string, Worker> = {};
    private queueEvents: Record<string, QueueEvents> = {};

    constructor() {
        this.initQueues();
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
        return queue.add(jobName, data, opts);
    }

    public registerWorker(queueName: string, processor: (job: Job) => Promise<any>, concurrency = 1) {
        if (this.workers[queueName]) {
            log.warn(`Worker for ${queueName} already registered`);
            return;
        }

        const worker = new Worker(queueName, processor, {
            connection,
            concurrency,
            limiter: {
                max: 10,
                duration: 1000,
            }
        });

        worker.on('completed', (job) => {
            log.info({ jobId: job.id }, `Job completed in ${queueName}`);
        });

        worker.on('failed', (job, err) => {
            log.error({ jobId: job?.id, err }, `Job failed in ${queueName}`);
        });

        this.workers[queueName] = worker;
        log.info(`Worker registered for ${queueName} with concurrency ${concurrency}`);
    }

    public async close() {
        await Promise.all(Object.values(this.queues).map(q => q.close()));
        await Promise.all(Object.values(this.workers).map(w => w.close()));
        await Promise.all(Object.values(this.queueEvents).map(e => e.close()));
        connection.disconnect();
        log.info('QueueService closed');
    }
}

export const queueService = new QueueService();
