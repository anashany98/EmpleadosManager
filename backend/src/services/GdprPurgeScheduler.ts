import cron, { ScheduledTask } from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { createLogger } from './LoggerService';

const execAsync = promisify(exec);

const log = createLogger('GdprPurgeScheduler');

/**
 * GDPR compliance: schedules the periodic purge of soft-deleted employees.
 *
 * The purge script (`scripts/purge-soft-deleted-employees.ts`) nulls out
 * PII fields (dni, iban, name, email, etc.) and salary data for employees
 * whose `deletedAt` is older than the configured retention period.
 *
 * Per GDPR Art. 5(1)(e), personal data must be kept no longer than
 * necessary. Default retention is 4 years (Spanish LGSS payroll retention).
 *
 * Schedule: weekly on Sunday at 04:00 (after the weekly full backup at 03:00).
 *
 * Disable via env: GDPR_PURGE_SCHEDULER_ENABLED=false
 */
export class GdprPurgeScheduler {
    private job: ScheduledTask | null = null;
    private isRunning = false;

    public start(): void {
        if (this.isRunning) {
            log.warn('GdprPurgeScheduler already running');
            return;
        }

        if (process.env.GDPR_PURGE_SCHEDULER_ENABLED === 'false') {
            log.info('GdprPurgeScheduler disabled via GDPR_PURGE_SCHEDULER_ENABLED=false');
            return;
        }

        log.info('Starting GDPR purge scheduler (weekly on Sunday at 04:00)...');
        this.isRunning = true;

        // Sunday 04:00 — after the weekly full backup at 03:00
        this.job = cron.schedule('0 4 * * 0', async () => {
            log.info('Starting scheduled GDPR purge...');
            try {
                const retentionYears = parseInt(process.env.GDPR_PURGE_RETENTION_YEARS || '4', 10);
                const scriptPath = path.resolve(__dirname, '../../../scripts/purge-soft-deleted-employees.sh');
                const { stdout, stderr } = await execAsync(
                    `bash "${scriptPath}" --no-dry-run --retention-years ${retentionYears}`
                );
                if (stdout) log.info({ stdout: stdout.trim() }, 'GDPR purge stdout');
                if (stderr) log.warn({ stderr: stderr.trim() }, 'GDPR purge stderr');
                log.info('Scheduled GDPR purge completed');
            } catch (error) {
                log.error({ error }, 'Scheduled GDPR purge failed');
            }
        });

        log.info('GDPR purge scheduler started');
    }

    public stop(): void {
        if (this.job) {
            this.job.stop();
            this.job = null;
        }
        this.isRunning = false;
        log.info('GDPR purge scheduler stopped');
    }
}

export const gdprPurgeScheduler = new GdprPurgeScheduler();