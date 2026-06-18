import { redis } from '../config/redis';
import { createLogger } from './LoggerService';

const log = createLogger('RedisRateLimiter');

/**
 * Sliding-window rate limiter backed by Redis INCR + EXPIRE.
 * Suitable for rate-limiting authentication attempts, PIN tries, and
 * other small stateful counters that must be shared across multiple
 * backend instances. The TTL is set on first increment so a key that
 * is not used for a window length will expire and free memory.
 */
export class RedisRateLimiter {
    /**
     * Atomically increment the counter for `key` and check whether it
     * exceeds `limit`. If so, returns the remaining cooldown in seconds
     * (0 if the caller is still under the limit).
     */
    static async hit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; count: number; retryAfterSeconds: number }> {
        try {
            const fullKey = `rl:${key}`;
            const pipeline = redis.multi();
            pipeline.incr(fullKey);
            pipeline.ttl(fullKey);
            const results = await pipeline.exec();

            if (!results || results.length < 2) {
                log.warn({ key }, 'Redis rate limiter pipeline returned no result; failing open');
                return { allowed: true, count: 0, retryAfterSeconds: 0 };
            }

            const incrResult = results[0];
            const ttlResult = results[1];
            const count = Number(incrResult?.[1] ?? 0);
            let ttl = Number(ttlResult?.[1] ?? -1);

            if (count === 1 || ttl < 0) {
                // First hit OR key without TTL (should not happen but guard)
                await redis.expire(fullKey, windowSeconds);
                ttl = windowSeconds;
            }

            if (count > limit) {
                return { allowed: false, count, retryAfterSeconds: ttl };
            }

            return { allowed: true, count, retryAfterSeconds: 0 };
        } catch (error) {
            // Fail open: do not block legit traffic if Redis is down.
            // The error is logged so the operator can act on it.
            log.error({ err: error, key }, 'Redis rate limiter failed; allowing request');
            return { allowed: true, count: 0, retryAfterSeconds: 0 };
        }
    }

    /**
     * Reset a counter (e.g. after a successful authentication).
     */
    static async reset(key: string): Promise<void> {
        try {
            await redis.del(`rl:${key}`);
        } catch (error) {
            log.warn({ err: error, key }, 'Failed to reset rate limit counter');
        }
    }

    /**
     * Distributed deduplication helper. Returns true if this is the first
     * time we see `key`; false if it has been seen before within `ttlSeconds`.
     */
    static async dedupe(key: string, ttlSeconds: number, value?: string): Promise<{ firstTime: boolean; existing: string | null }> {
        try {
            const fullKey = `dedupe:${key}`;
            // SET ... NX EX <ttl> is atomic and returns OK only if the
            // key did not exist before. If it existed, we GET the value.
            const result = await redis.set(fullKey, value ?? '1', 'EX', ttlSeconds, 'NX');
            if (result === 'OK') {
                return { firstTime: true, existing: null };
            }
            const existing = await redis.get(fullKey);
            return { firstTime: false, existing };
        } catch (error) {
            log.error({ err: error, key }, 'Redis dedupe failed; allowing');
            return { firstTime: true, existing: null };
        }
    }
}
