import { alertService } from './AlertService';
// import { backupScheduler } from './BackupScheduler';  // DISABLED: prodrigestivill container handles automated backups
import { loggers } from './LoggerService';
import { vacationRolloverScheduler } from './VacationRolloverScheduler';

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

        // DISABLED: automated backup is now handled by the prodrigestivill
        // container in docker-compose.yml (service "backup"). That container
        // is independent of the backend process and persists backups to the
        // backup_data volume + S3.
        // The on-demand HTTP endpoint POST /api/config/backup still works
        // for manual snapshots via BackupService.
        // backupScheduler.start();
        vacationRolloverScheduler.start();

        log.info('All scheduler tasks started');
    }

    public stop() {
        if (this.alertInterval) {
            clearInterval(this.alertInterval);
            this.alertInterval = null;
        }

        // backupScheduler.stop();
        vacationRolloverScheduler.stop();

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
