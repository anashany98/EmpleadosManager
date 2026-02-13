import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import { createLogger } from './LoggerService';

const log = createLogger('QueueService');

const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
};

export const connection = new IORedis(redisConfig);

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
