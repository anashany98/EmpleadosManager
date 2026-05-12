type CacheOptions = {
    ttlMs?: number;
    now?: () => number;
};

type CacheEntry<T> = {
    expiresAt: number;
    promise: Promise<T>;
};

const DEFAULT_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry<unknown>>();

function getCacheKey(employeeId: string, year: number) {
    return `${employeeId}:${year}`;
}

export function getVacationBalanceWithCache<T>(
    employeeId: string,
    year: number,
    load: () => Promise<T>,
    options: CacheOptions = {}
): Promise<T> {
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    const now = options.now ?? Date.now;
    const key = getCacheKey(employeeId, year);
    const existing = cache.get(key) as CacheEntry<T> | undefined;

    if (existing && existing.expiresAt > now()) {
        return existing.promise;
    }

    const promise = load().catch((error) => {
        const current = cache.get(key);
        if (current?.promise === promise) {
            cache.delete(key);
        }
        throw error;
    });

    cache.set(key, {
        expiresAt: now() + ttlMs,
        promise
    });

    return promise;
}

export function invalidateVacationBalanceCache(employeeId: string, year?: number) {
    if (typeof year === 'number') {
        cache.delete(getCacheKey(employeeId, year));
        return;
    }

    const prefix = `${employeeId}:`;
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
            cache.delete(key);
        }
    }
}

export function clearVacationBalanceCache() {
    cache.clear();
}
