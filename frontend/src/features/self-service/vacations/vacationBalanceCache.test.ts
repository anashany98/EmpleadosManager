import { describe, expect, it } from 'vitest';
import { clearVacationBalanceCache, getVacationBalanceWithCache, invalidateVacationBalanceCache } from './vacationBalanceCache';

function createDeferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}

describe('getVacationBalanceWithCache', () => {
    it('deduplicates in-flight requests for the same employee and year', async () => {
        clearVacationBalanceCache();
        const deferred = createDeferred<{ availableDays: number }>();
        let loadCount = 0;
        const load = () => {
            loadCount += 1;
            return deferred.promise;
        };

        const first = getVacationBalanceWithCache('employee-1', 2026, load);
        const second = getVacationBalanceWithCache('employee-1', 2026, load);

        expect(loadCount).toBe(1);
        deferred.resolve({ availableDays: 20 });

        await expect(first).resolves.toEqual({ availableDays: 20 });
        await expect(second).resolves.toEqual({ availableDays: 20 });
    });

    it('caches resolved balances until the ttl expires', async () => {
        clearVacationBalanceCache();
        let now = 1_000;
        let loadCount = 0;
        const load = async () => {
            loadCount += 1;
            return { availableDays: 30 - loadCount };
        };

        await expect(getVacationBalanceWithCache('employee-1', 2026, load, { ttlMs: 500, now: () => now })).resolves.toEqual({ availableDays: 29 });
        await expect(getVacationBalanceWithCache('employee-1', 2026, load, { ttlMs: 500, now: () => now })).resolves.toEqual({ availableDays: 29 });
        expect(loadCount).toBe(1);

        now = 1_501;

        await expect(getVacationBalanceWithCache('employee-1', 2026, load, { ttlMs: 500, now: () => now })).resolves.toEqual({ availableDays: 28 });
        expect(loadCount).toBe(2);
    });

    it('can invalidate one cached employee/year balance', async () => {
        clearVacationBalanceCache();
        let loadCount = 0;
        const load = async () => {
            loadCount += 1;
            return { availableDays: 30 - loadCount };
        };

        await getVacationBalanceWithCache('employee-1', 2026, load);
        invalidateVacationBalanceCache('employee-1', 2026);
        await expect(getVacationBalanceWithCache('employee-1', 2026, load)).resolves.toEqual({ availableDays: 28 });
        expect(loadCount).toBe(2);
    });
});
