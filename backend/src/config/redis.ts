import IORedis, { type RedisOptions } from 'ioredis';
import { createLogger } from '../services/LoggerService';

const log = createLogger('RedisClient');

function buildRedisConfig(): string | RedisOptions {
    const redisUrl = process.env.REDIS_URL;
    const password = process.env.REDIS_PASSWORD;

    if (redisUrl) {
        if (password && !redisUrl.includes('@')) {
            const urlObj = new URL(redisUrl);
            urlObj.password = password;
            const urlWithPassword = urlObj.toString();
            log.info('Using REDIS_URL for connection with password');
            return urlWithPassword;
        }
        log.info('Using REDIS_URL for connection');
        return redisUrl;
    }

    const host = process.env.REDIS_HOST;
    const port = parseInt(process.env.REDIS_PORT || '6379');

    const config: RedisOptions = {
        host: host || 'localhost',
        port,
        maxRetriesPerRequest: null,
    };

    if (password) {
        config.password = password;
        log.info(`Connecting to Redis at ${host}:${port} with password`);
    } else {
        log.info(`Connecting to Redis at ${host}:${port} (no password)`);
    }

    return config;
}

const redisConfig = buildRedisConfig();
let redisInstance: any;
if (process.env.REDIS_MOCK === 'true') {
    // Simple in-memory mock with the minimal Redis API used in tests.
    class MockRedis {
        private store = new Map<string, unknown>();
        private expiresAt = new Map<string, number>();
        private pipeline: Array<() => Promise<unknown>> | null = null;

        private cleanupExpired(key: string) {
            const expires = this.expiresAt.get(key);
            if (expires !== undefined && expires <= Date.now()) {
                this.store.delete(key);
                this.expiresAt.delete(key);
            }
        }

        private async setImmediate(key: string, value: unknown, args: unknown[]) {
            this.cleanupExpired(key);
            const nx = args.includes('NX');
            if (nx && this.store.has(key)) {
                return null;
            }

            this.store.set(key, value);
            const exIndex = args.indexOf('EX');
            if (exIndex >= 0 && typeof args[exIndex + 1] === 'number') {
                this.expiresAt.set(key, Date.now() + Number(args[exIndex + 1]) * 1000);
            }
            return 'OK';
        }

        async set(key: string, value: unknown, ...args: unknown[]) {
            return this.setImmediate(key, value, args);
        }

        async get(key: string) {
            this.cleanupExpired(key);
            return this.store.get(key) ?? null;
        }

        async incr(key: string) {
            if (this.pipeline) {
                this.pipeline.push(() => this.incrImmediate(key));
                return this;
            }
            return this.incrImmediate(key);
        }

        private async incrImmediate(key: string) {
            this.cleanupExpired(key);
            const next = Number(this.store.get(key) ?? 0) + 1;
            this.store.set(key, next);
            return next;
        }

        async ttl(key: string) {
            if (this.pipeline) {
                this.pipeline.push(() => this.ttlImmediate(key));
                return this;
            }
            return this.ttlImmediate(key);
        }

        private async ttlImmediate(key: string) {
            this.cleanupExpired(key);
            if (!this.store.has(key)) return -2;
            const expires = this.expiresAt.get(key);
            if (expires === undefined) return -1;
            return Math.max(0, Math.ceil((expires - Date.now()) / 1000));
        }

        async expire(key: string, seconds: number) {
            this.cleanupExpired(key);
            if (!this.store.has(key)) return 0;
            this.expiresAt.set(key, Date.now() + seconds * 1000);
            return 1;
        }

        async del(key: string) {
            this.cleanupExpired(key);
            const existed = this.store.delete(key);
            this.expiresAt.delete(key);
            return existed ? 1 : 0;
        }

        multi() {
            this.pipeline = [];
            return this;
        }

        async exec() {
            const queued = this.pipeline ?? [];
            this.pipeline = null;
            return Promise.all(queued.map(async command => [null, await command()]));
        }

        async ping() { return 'PONG'; }
        disconnect() { /* no-op */ }
        async quit() { return 'OK'; }
        on(_event: string, _handler: (...args: unknown[]) => void) { /* no-op */ }
    }
    redisInstance = new MockRedis();
    console.info('Using MockRedis for tests');
} else {
    redisInstance = typeof redisConfig === 'string'
        ? new IORedis(redisConfig, { maxRetriesPerRequest: null })
        : new IORedis(redisConfig);
}
export const redis = redisInstance;

redis.on('connect', () => {
    log.info('Redis client connected successfully');
});

redis.on('error', (err: unknown) => {
    log.error({ err }, 'Redis client connection error');
});

redis.on('ready', () => {
    log.info('Redis client ready');
});

export async function testRedisConnection(): Promise<boolean> {
    try {
        const result = await redis.ping();
        log.info(`Redis ping response: ${result}`);
        return result === 'PONG';
    } catch (error) {
        log.error({ error }, 'Redis connection test failed');
        return false;
    }
}

export default redis;
