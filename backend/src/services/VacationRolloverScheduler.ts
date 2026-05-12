import cron, { ScheduledTask } from 'node-cron';
import { createLogger } from './LoggerService';
import { materializeVacationBalancesForYear } from './VacationBalanceService';
import { archiveOldVacations } from './VacationArchivalService';

const log = createLogger('VacationRolloverScheduler');

export class VacationRolloverScheduler {
    private job: ScheduledTask | null = null;
    private isRunning = false;

    public start(): void {
        if (this.isRunning) {
            log.warn('VacationRolloverScheduler already running');
            return;
        }

        this.isRunning = true;
        log.info('Starting vacation rollover scheduler...');

        void this.ensureCurrentYearBalances('startup');

        this.job = cron.schedule('15 0 * * *', async () => {
            await this.ensureCurrentYearBalances('daily-check');
        });

        log.info('Vacation rollover scheduler started');
    }

    public stop(): void {
        if (this.job) {
            this.job.stop();
            this.job = null;
        }

        this.isRunning = false;
        log.info('Vacation rollover scheduler stopped');
    }

    public async runNow(year = new Date().getFullYear()): Promise<void> {
        await this.ensureBalancesForYear(year, 'manual-run');
    }

    private async ensureCurrentYearBalances(reason: string): Promise<void> {
        await this.ensureBalancesForYear(new Date().getFullYear(), reason);
    }

    private async ensureBalancesForYear(year: number, reason: string): Promise<void> {
        try {
            const result = await materializeVacationBalancesForYear(year);
            log.info({ reason, ...result }, 'Vacation balances materialized for year');

            const archiveResult = await archiveOldVacations(2);
            log.info({ ...archiveResult }, 'Old vacations archived');
        } catch (error) {
            log.error({ error, reason, year }, 'Failed to materialize vacation balances for year');
        }
    }
}

export const vacationRolloverScheduler = new VacationRolloverScheduler();
