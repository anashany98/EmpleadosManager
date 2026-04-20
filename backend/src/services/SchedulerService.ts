import { alertService } from './AlertService';
import { inboxService } from './InboxService';
import { backupScheduler } from './BackupScheduler';
import { loggers } from './LoggerService';

const log = loggers.scheduler;

export class SchedulerService {
    private alertInterval: NodeJS.Timeout | null = null;

    public start() {
        log.info('Starting scheduler services...');

        // Run alert checks immediately on startup
        this.runAlerts();

        // Schedule alert checks every 6 hours
        this.alertInterval = setInterval(() => {
            this.runAlerts();
        }, 6 * 60 * 60 * 1000);

        // Start backup scheduler
        backupScheduler.start();

        log.info('All scheduler tasks started');
    }

    public stop() {
        if (this.alertInterval) {
            clearInterval(this.alertInterval);
            this.alertInterval = null;
        }

        backupScheduler.stop();

        log.info('All scheduler tasks stopped');
    }

    private async runAlerts() {
        try {
            log.info('Running scheduled alert checks...');
            await alertService.runAllChecks();
            log.info('Alert checks completed');
        } catch (error) {
            log.error({ error }, 'Error running alerts');
        }
    }
}

export const schedulerService = new SchedulerService();
