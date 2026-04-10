import { beforeEach, describe, expect, it } from 'vitest';
import { createClientRequestId, OfflineClockQueue, type ClockQueueItem } from './offlineClockQueue';

describe('OfflineClockQueue', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('generates a persistent clientRequestId when enqueueing a legacy payload', () => {
        const item = OfflineClockQueue.enqueue({
            type: 'IN',
            payload: {
                type: 'IN',
                latitude: null,
                longitude: null,
                device: 'browser',
                timestamp: '2026-03-13T10:00:00.000Z'
            }
        } satisfies Omit<ClockQueueItem, 'id' | 'createdAt'>);

        expect(item.payload.clientRequestId).toBeTruthy();
        expect(OfflineClockQueue.getAll()[0].payload.clientRequestId).toBe(item.payload.clientRequestId);
    });

    it('keeps the same clientRequestId when reloading queued items', () => {
        const clientRequestId = createClientRequestId();
        localStorage.setItem('offline_clock_queue_v1', JSON.stringify([
            {
                id: 'queue-item',
                type: 'OUT',
                createdAt: '2026-03-13T10:00:00.000Z',
                payload: {
                    type: 'OUT',
                    latitude: 39.5,
                    longitude: 2.6,
                    device: 'browser',
                    timestamp: '2026-03-13T10:00:00.000Z',
                    clientRequestId
                }
            }
        ]));

        const [item] = OfflineClockQueue.getAll();

        expect(item.payload.clientRequestId).toBe(clientRequestId);
    });
});
