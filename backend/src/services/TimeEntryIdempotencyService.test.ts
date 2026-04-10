import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { TimeEntryIdempotencyService } from './TimeEntryIdempotencyService';

vi.mock('../lib/prisma', () => ({
    prisma: {
        timeEntry: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn()
        }
    }
}));

describe('TimeEntryIdempotencyService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns an existing entry when clientRequestId already exists', async () => {
        const existingEntry = {
            id: 'entry-1',
            employeeId: 'emp-1',
            type: 'IN'
        };

        (prisma.timeEntry.findUnique as any).mockResolvedValue(existingEntry);

        const result = await TimeEntryIdempotencyService.create({
            employeeId: 'emp-1',
            type: 'IN',
            timestamp: new Date('2026-03-13T10:00:00.000Z'),
            clientRequestId: 'req-1'
        });

        expect(prisma.timeEntry.create).not.toHaveBeenCalled();
        expect(result).toEqual({
            entry: existingEntry,
            deduplicated: true,
            dedupedBy: 'clientRequestId'
        });
    });

    it('falls back to timestamp dedupe when clientRequestId is not provided', async () => {
        const existingEntry = {
            id: 'entry-2',
            employeeId: 'emp-1',
            type: 'OUT'
        };

        (prisma.timeEntry.findFirst as any).mockResolvedValue(existingEntry);

        const result = await TimeEntryIdempotencyService.create({
            employeeId: 'emp-1',
            type: 'OUT',
            timestamp: new Date('2026-03-13T10:00:00.000Z')
        });

        expect(prisma.timeEntry.create).not.toHaveBeenCalled();
        expect(result).toEqual({
            entry: existingEntry,
            deduplicated: true,
            dedupedBy: 'timestamp'
        });
    });

    it('resolves concurrent replays from the unique clientRequestId constraint', async () => {
        const existingEntry = {
            id: 'entry-3',
            employeeId: 'emp-1',
            type: 'IN'
        };

        (prisma.timeEntry.findUnique as any)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(existingEntry);
        (prisma.timeEntry.create as any).mockRejectedValue({ code: 'P2002' });

        const result = await TimeEntryIdempotencyService.create({
            employeeId: 'emp-1',
            type: 'IN',
            timestamp: new Date('2026-03-13T10:00:00.000Z'),
            clientRequestId: 'req-race'
        });

        expect(result).toEqual({
            entry: existingEntry,
            deduplicated: true,
            dedupedBy: 'clientRequestId'
        });
    });
});
