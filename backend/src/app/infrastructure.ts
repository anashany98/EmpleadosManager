import { inboxService } from '../services/InboxService';
import { schedulerService } from '../services/SchedulerService';
import { queueService } from '../services/QueueService';
import { initWorkers } from '../workers';
import { EncryptionService } from '../services/EncryptionService';

export function validateRuntimeConfiguration(): void {
    EncryptionService.validateKey();
}

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
