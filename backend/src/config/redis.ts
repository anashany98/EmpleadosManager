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
    //
    // Cubre los comandos de ioredis que la app usa directamente
    // (GET/SET/INCR/EXPIRE/DEL/PING) y el protocolo que
    // `rate-limit-redis` espera vía `sendCommand` (SCRIPT LOAD +
    // EVALSHA + EVAL sobre los scripts de Lua `increment` y `get`).
    // Sin esto último, los tests de rate-limit revientan con
    // `redis.call is not a function` antes de llegar a auth.
    class MockRedis {
        private store = new Map<string, unknown>();
        private expiresAt = new Map<string, number>();
        private pipeline: Array<() => Promise<unknown>> | null = null;
        /** SHA1 → script body (para soportar EVALSHA). */
        private scripts = new Map<string, string>();

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
            // Soportar EX (segundos) y PX (milisegundos). Los
            // argumentos llegan como strings cuando vienen de
            // `redis.call(...)` pero como numbers cuando vienen
            // directamente desde `this.set(...)`, por eso
            // coercionamos a Number y validamos que sea finito.
            const exIndex = args.indexOf('EX');
            if (exIndex >= 0) {
                const seconds = Number(args[exIndex + 1]);
                if (Number.isFinite(seconds) && seconds > 0) {
                    this.expiresAt.set(key, Date.now() + seconds * 1000);
                }
            }
            const pxIndex = args.indexOf('PX');
            if (pxIndex >= 0) {
                const ms = Number(args[pxIndex + 1]);
                if (Number.isFinite(ms) && ms > 0) {
                    this.expiresAt.set(key, Date.now() + ms);
                }
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

        /**
         * PTTL — devuelve el TTL en milisegundos. -2 si la clave no
         * existe, -1 si existe sin TTL.
         */
        async pttl(key: string) {
            this.cleanupExpired(key);
            if (!this.store.has(key)) return -2;
            const expires = this.expiresAt.get(key);
            if (expires === undefined) return -1;
            return Math.max(0, expires - Date.now());
        }

        async expire(key: string, seconds: number) {
            this.cleanupExpired(key);
            if (!this.store.has(key)) return 0;
            this.expiresAt.set(key, Date.now() + seconds * 1000);
            return 1;
        }

        /**
         * PEXPIRE — igual que EXPIRE pero con milisegundos.
         */
        async pexpire(key: string, ms: number) {
            this.cleanupExpired(key);
            if (!this.store.has(key)) return 0;
            this.expiresAt.set(key, Date.now() + Number(ms));
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

        /**
         * Hash determinista (no criptográfica) para identificar un
         * script Lua. No es un SHA1 real: solo necesitamos
         * estabilidad entre `SCRIPT LOAD` y `EVALSHA` subsecuentes
         * dentro del mismo proceso. `String.prototype` ya es
         * razonablemente único para los scripts que carga
         * `rate-limit-redis`.
         */
        private fakeSha1(body: string): string {
            let h1 = 0xdeadbeef;
            let h2 = 0x41c6ce57;
            for (let i = 0; i < body.length; i++) {
                const ch = body.charCodeAt(i);
                h1 = Math.imul(h1 ^ ch, 2654435761);
                h2 = Math.imul(h2 ^ ch, 1597334677);
            }
            h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
            h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
            h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
            h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
            return ((h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')).padStart(40, '0');
        }

        /**
         * Implementa los dos scripts que `rate-limit-redis` v5
         * carga. Como no hay intérprete de Lua en Node, replico la
         * lógica en JS pero conservando la misma forma de
         * respuesta: `[totalHits, timeToExpire]`.
         */
        private async runScript(script: string, keys: string[], argv: string[]): Promise<[number, number]> {
            const key = keys[0];
            if (!key) {
                throw new Error('MockRedis: script invocado sin KEYS[1]');
            }
            // Script `increment`: PTTL → si expiró, SET 1 PX windowMs
            // y devuelve [1, windowMs]; si no, INCR; y si
            // resetOnChange, PEXPIRE windowMs. Devuelve
            // [totalHits, timeToExpire].
            if (script.includes('local windowMs = tonumber(ARGV[2])')) {
                const windowMs = Number(argv[1]);
                const resetOnChange = argv[0] === '1';
                const ttl = await this.pttl(key);
                if (ttl <= 0) {
                    await this.set(key, 1, 'PX', windowMs);
                    return [1, windowMs];
                }
                const totalHits = (await this.incr(key)) as number;
                if (resetOnChange) {
                    await this.pexpire(key, windowMs);
                    return [totalHits, windowMs];
                }
                return [totalHits, ttl];
            }
            // Script `get`: GET + PTTL → [totalHits, timeToExpire].
            if (script.includes('local totalHits = redis.call("GET"')) {
                const value = await this.get(key);
                const totalHits = Number(value ?? 0);
                const timeToExpire = await this.pttl(key);
                return [totalHits, timeToExpire];
            }
            throw new Error('MockRedis: script Lua no soportado por el mock');
        }

        /**
         * `call` — punto de entrada que `rate-limit-redis` usa vía
         * `sendCommand: (...args) => redis.call(...args)`. Despacha a
         * los métodos existentes o ejecuta scripts Lua.
         */
        async call(command: string, ...args: unknown[]): Promise<unknown> {
            const upper = command.toUpperCase();
            switch (upper) {
                case 'SCRIPT': {
                    if (args[0] === 'LOAD') {
                        const body = String(args[1] ?? '');
                        const sha = this.fakeSha1(body);
                        this.scripts.set(sha, body);
                        return sha;
                    }
                    return null;
                }
                case 'EVAL': {
                    const script = String(args[0] ?? '');
                    const numKeys = Number(args[1] ?? 0);
                    const keys = args.slice(2, 2 + numKeys).map(String);
                    const argv = args.slice(2 + numKeys).map(String);
                    return this.runScript(script, keys, argv);
                }
                case 'EVALSHA': {
                    const sha = String(args[0] ?? '');
                    const script = this.scripts.get(sha);
                    if (!script) {
                        // En Redis real sería `NOSCRIPT`. El caller
                        // hace fallback a EVAL. Para simplificar,
                        // devolvemos null y dejamos que el caller
                        // (rate-limit-redis) decida.
                        return null;
                    }
                    const numKeys = Number(args[1] ?? 0);
                    const keys = args.slice(2, 2 + numKeys).map(String);
                    const argv = args.slice(2 + numKeys).map(String);
                    return this.runScript(script, keys, argv);
                }
                case 'INCR':
                    return this.incr(String(args[0] ?? ''));
                case 'GET':
                    return this.get(String(args[0] ?? ''));
                case 'SET':
                    return this.set(String(args[0] ?? ''), args[1] ?? null, ...args.slice(2));
                case 'DEL':
                    return this.del(String(args[0] ?? ''));
                case 'EXPIRE':
                    return this.expire(String(args[0] ?? ''), Number(args[1] ?? 0));
                case 'PEXPIRE':
                    return this.pexpire(String(args[0] ?? ''), Number(args[1] ?? 0));
                case 'TTL':
                    return this.ttl(String(args[0] ?? ''));
                case 'PTTL':
                    return this.pttl(String(args[0] ?? ''));
                case 'PING':
                    return this.ping();
                default:
                    throw new Error(`MockRedis: comando no soportado '${command}'`);
            }
        }
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
