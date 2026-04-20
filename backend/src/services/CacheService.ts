/**
 * In-memory LRU Cache with TTL support.
 * Uses Node's built-in Map for simplicity and efficiency.
 */

interface CacheEntry<T> {
    value: T;
    expiry: number | null; // null = no expiry
}

const MAX_CACHE_SIZE = 500;
const CLEANUP_INTERVAL_MS = 60 * 1000; // 60 seconds

class CacheServiceImpl {
    private cache: Map<string, CacheEntry<unknown>>;
    private accessOrder: string[]; // Track LRU order
    private cleanupTimer: NodeJS.Timeout | null = null;

    constructor() {
        this.cache = new Map();
        this.accessOrder = [];
        this.startCleanup();
    }

    /**
     * Gets a value from the cache.
     * Returns undefined if not found or expired.
     */
    get<T>(key: string): T | undefined {
        const entry = this.cache.get(key);

        if (!entry) {
            return undefined;
        }

        // Check expiry
        if (entry.expiry !== null && Date.now() > entry.expiry) {
            this.del(key);
            return undefined;
        }

        // Update LRU order
        this.updateLRU(key);
        return entry.value as T;
    }

    /**
     * Sets a value in the cache with optional TTL.
     * @param key Cache key
     * @param value Value to cache
     * @param ttlSeconds Time-to-live in seconds (optional)
     */
    set<T>(key: string, value: T, ttlSeconds?: number): void {
        // LRU eviction if at capacity
        if (!this.cache.has(key) && this.cache.size >= MAX_CACHE_SIZE) {
            this.evictLRU();
        }

        const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;

        this.cache.set(key, { value, expiry });
        this.updateLRU(key);
    }

    /**
     * Deletes a specific key from the cache.
     */
    del(key: string): void {
        this.cache.delete(key);
        this.accessOrder = this.accessOrder.filter(k => k !== key);
    }

    /**
     * Clears all entries from the cache.
     */
    clear(): void {
        this.cache.clear();
        this.accessOrder = [];
    }

    /**
     * Gets a value from cache or executes the function and caches the result.
     * This is the primary pattern for caching expensive operations.
     *
     * @param key Cache key
     * @param fn Async function to call if cache miss
     * @param ttlSeconds Optional TTL in seconds
     * @returns Cached or fresh value
     */
    async wrap<T>(key: string, fn: () => Promise<T>, ttlSeconds?: number): Promise<T> {
        const cached = this.get<T>(key);
        if (cached !== undefined) {
            return cached;
        }

        const result = await fn();
        this.set(key, result, ttlSeconds);
        return result;
    }

    /**
     * Invalidates all cache entries for a specific company.
     * Useful when company data changes (e.g., new employee, updated vacation).
     *
     * @param companyId Company identifier
     */
    invalidateCompanyCache(companyId: string): void {
        const prefix = `${companyId}:`;
        const keysToDelete: string[] = [];

        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.del(key));
    }

    /**
     * Invalidates cache entries matching a specific prefix pattern.
     *
     * @param prefix Key prefix to match
     */
    invalidateByPrefix(prefix: string): void {
        const keysToDelete: string[] = [];

        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.del(key));
    }

    /**
     * Updates the LRU tracking for a key.
     */
    private updateLRU(key: string): void {
        // Remove from current position
        this.accessOrder = this.accessOrder.filter(k => k !== key);
        // Add to end (most recently used)
        this.accessOrder.push(key);
    }

    /**
     * Evicts the least recently used entry.
     */
    private evictLRU(): void {
        if (this.accessOrder.length === 0) {
            return;
        }

        const lruKey = this.accessOrder.shift();
        if (lruKey) {
            this.cache.delete(lruKey);
        }
    }

    /**
     * Starts the background cleanup of expired entries.
     */
    private startCleanup(): void {
        if (this.cleanupTimer) {
            return;
        }

        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, CLEANUP_INTERVAL_MS);

        // Prevent timer from keeping process alive
        this.cleanupTimer.unref();
    }

    /**
     * Removes all expired entries from the cache.
     */
    private cleanup(): void {
        const now = Date.now();
        const keysToDelete: string[] = [];

        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiry !== null && now > entry.expiry) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.del(key));

        if (keysToDelete.length > 0) {
            console.log(`[CacheService] Cleaned up ${keysToDelete.length} expired entries`);
        }
    }

    /**
     * Gets cache statistics for monitoring.
     */
    getStats(): { size: number; maxSize: number } {
        return {
            size: this.cache.size,
            maxSize: MAX_CACHE_SIZE
        };
    }

    /**
     * Stops the cleanup timer. Useful for testing.
     */
    stopCleanup(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }
}

// Singleton instance
export const CacheService = new CacheServiceImpl();
