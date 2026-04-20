import cron, { ScheduledTask } from 'node-cron';
import { BackupService } from './BackupService';
import { createLogger } from './LoggerService';

const log = createLogger('BackupScheduler');

interface ScheduledJob {
    name: string;
    task: ScheduledTask;
}

export class BackupScheduler {
    private jobs: ScheduledJob[] = [];
    private isRunning: boolean = false;

    public start(): void {
        if (this.isRunning) {
            log.warn('BackupScheduler already running');
            return;
        }

        log.info('Starting backup scheduler...');
        this.isRunning = true;

        const dailySnapshot = cron.schedule('0 2 * * *', async () => {
            log.info('Starting scheduled daily snapshot...');
            try {
                const result = await BackupService.createSnapshot();
                log.info(`Daily snapshot completed: ${result.fileName} (${result.size} bytes)`);
            } catch (error) {
                log.error({ error }, 'Daily snapshot failed');
            }
        });

        const weeklyFullBackup = cron.schedule('0 3 * * 0', async () => {
            log.info('Starting scheduled weekly full backup...');
            try {
                const result = await BackupService.createFullBackup();
                log.info(`Weekly full backup completed: ${result.fileName} (${result.size} bytes)`);
            } catch (error) {
                log.error({ error }, 'Weekly full backup failed');
            }
        });

        this.jobs = [
            { name: 'dailySnapshot', task: dailySnapshot },
            { name: 'weeklyFullBackup', task: weeklyFullBackup }
        ];

        log.info('Backup scheduler started with jobs: ' + this.jobs.map(j => j.name).join(', '));
    }

    public stop(): void {
        log.info('Stopping backup scheduler...');
        this.jobs.forEach(job => job.task.stop());
        this.jobs = [];
        this.isRunning = false;
        log.info('Backup scheduler stopped');
    }

    public async runSnapshotNow(): Promise<void> {
        log.info('Manual snapshot triggered');
        await BackupService.createSnapshot();
    }

    public async runFullBackupNow(): Promise<void> {
        log.info('Manual full backup triggered');
        await BackupService.createFullBackup();
    }

    public getStatus(): { running: boolean; jobs: string[] } {
        return {
            running: this.isRunning,
            jobs: this.jobs.map(j => j.name)
        };
    }
}

export const backupScheduler = new BackupScheduler();
