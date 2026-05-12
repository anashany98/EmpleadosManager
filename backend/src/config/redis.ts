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
export const redis = typeof redisConfig === 'string'
    ? new IORedis(redisConfig, { maxRetriesPerRequest: null })
    : new IORedis(redisConfig);

redis.on('connect', () => {
    log.info('Redis client connected successfully');
});

redis.on('error', (err) => {
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