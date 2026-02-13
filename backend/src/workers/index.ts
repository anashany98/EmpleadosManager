import { queueService, QUEUES } from '../services/QueueService';
import { FileProcessor } from './FileProcessor';
import { createLogger } from '../services/LoggerService';

const log = createLogger('Workers');

export const initWorkers = () => {
    log.info('Initializing workers...');

    // Register FileProcessor for Ingestion Queue
    queueService.registerWorker(QUEUES.INGESTION, FileProcessor, 5); // Concurrency 5

    log.info('Workers initialized');
};
