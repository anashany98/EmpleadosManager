import { inboxService } from '../services/InboxService';
import { schedulerService } from '../services/SchedulerService';
import { queueService } from '../services/QueueService';
import { initWorkers } from '../workers';
import { validateRuntimeConfiguration } from './configValidator';

export { validateRuntimeConfiguration };

export function startInfrastructure(): void {
    inboxService.start();
    schedulerService.start();
    initWorkers();
}

export async function stopInfrastructure(): Promise<void> {
    schedulerService.stop();
    inboxService.stop();
    await queueService.close();
}
