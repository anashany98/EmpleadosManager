import { queueService, QUEUES } from '../services/QueueService';
import { FileProcessor, ocrPool } from './FileProcessor';
import { PayrollAutomationService } from '../services/PayrollAutomationService';
import { createLogger } from '../services/LoggerService';

const log = createLogger('Workers');

export const initWorkers = async () => {
    log.info('Initializing workers...');

    // Pre-warm the Tesseract pool so the first job does not pay the
    // ~5s worker creation latency.
    try {
        await ocrPool.init();
    } catch (err) {
        log.error({ err }, 'Failed to pre-warm OCR pool; will lazy-init on first job');
    }

    // Concurrency 5 matches the previous behaviour, but each FileProcessor
    // instance now contends for OCR workers (pool size = 2) so the *real*
    // effective OCR concurrency is bounded.
    queueService.registerWorker(QUEUES.INGESTION, FileProcessor, 5);

    // Payroll generation runs as a single concurrent worker because it
    // writes a batch in one transaction. Multiple concurrent jobs from
    // different companies can run, but we cap overall concurrency at 2
    // to avoid pile-up on the DB.
    queueService.registerWorker(
        QUEUES.PAYROLL_GENERATION,
        PayrollAutomationService.processPayrollGenerationJob,
        2
    );

    log.info('Workers initialized');
};

export const stopWorkers = async () => {
    log.info('Stopping workers and OCR pool...');
    await ocrPool.close();
    await queueService.close();
    log.info('Workers stopped');
};
