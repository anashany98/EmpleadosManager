// MED-001: el MockRedis implementa el contrato mínimo que
// `rate-limit-redis` espera vía `sendCommand: (...args) => redis.call(...args)`.
// Sin `call`, los tests de rate limit revientan con
// `redis.call is not a function` antes de llegar a auth.
//
// Verifica:
//   1. `call` despacha SCRIPT LOAD → devuelve SHA determinista por
//      cuerpo de script
//   2. `call` ejecuta el script `increment` (EVAL/EVALSHA): INCR +
//      PEXPIRE atómicos, mismo comportamiento que Lua
//   3. `call` ejecuta el script `get`: devuelve [hits, ttl]
//   4. `call` despacha comandos individuales (INCR/GET/SET/EXPIRE/
//      PEXPIRE/TTL/PTTL/DEL/PING)
//   5. SET soporta EX (segundos) y PX (milisegundos)
//   6. PTTL/PEXPIRE en milisegundos (no en segundos)

import { beforeEach, describe, expect, it } from 'vitest';
import { redis } from '../../config/redis';

describe('MED-001 — MockRedis: contrato para rate-limit-redis', () => {
    beforeEach(async () => {
        // Limpiar todas las claves del test anterior
        const keys = ['test:incr', 'test:get', 'test:set-ex', 'test:set-px', 'test:exp', 'test:pexp', 'test:pttl'];
        for (const k of keys) {
            await redis.del(k);
        }
    });

    it('SCRIPT LOAD devuelve un SHA estable para el mismo cuerpo', async () => {
        const sha1 = await (redis as any).call('SCRIPT', 'LOAD', 'return 1');
        const sha2 = await (redis as any).call('SCRIPT', 'LOAD', 'return 1');
        const sha3 = await (redis as any).call('SCRIPT', 'LOAD', 'return 2');
        expect(typeof sha1).toBe('string');
        expect(sha1.length).toBe(40);
        expect(sha1).toBe(sha2);
        expect(sha1).not.toBe(sha3);
    });

    it('EVAL ejecuta el script `increment` de rate-limit-redis', async () => {
        const incrementScript = `
            local windowMs = tonumber(ARGV[2])
            local resetOnChange = ARGV[1] == "1"
            local timeToExpire = redis.call("PTTL", KEYS[1])
            if timeToExpire <= 0 then
                redis.call("SET", KEYS[1], 1, "PX", windowMs)
                return { 1, windowMs }
            end
            local totalHits = redis.call("INCR", KEYS[1])
            if resetOnChange then
                redis.call("PEXPIRE", KEYS[1], windowMs)
                timeToExpire = windowMs
            end
            return { totalHits, timeToExpire }
        `.replaceAll(/^\s+/gm, '').trim();
        const key = 'test:incr';
        await redis.del(key);

        // Primera llamada: TTL = 0 → SET 1 PX 60000, devuelve [1, 60000]
        const first = await (redis as any).call('EVAL', incrementScript, '1', key, '0', '60000');
        expect(Array.isArray(first)).toBe(true);
        expect(first[0]).toBe(1);
        expect(first[1]).toBe(60000);

        // Segunda llamada: TTL > 0 → INCR → [2, ttl]
        const second = await (redis as any).call('EVAL', incrementScript, '1', key, '0', '60000');
        expect(second[0]).toBe(2);
        // El TTL devuelto es el restante (puede ser un poco menos que 60000)
        expect(second[1]).toBeGreaterThan(59000);
        expect(second[1]).toBeLessThanOrEqual(60000);

        // Tercera llamada con resetOnChange=1: PEXPIRE resetea el TTL
        const third = await (redis as any).call('EVAL', incrementScript, '1', key, '1', '60000');
        expect(third[0]).toBe(3);
        expect(third[1]).toBe(60000);
    });

    it('EVAL ejecuta el script `get` de rate-limit-redis', async () => {
        const getScript = `
            local totalHits = redis.call("GET", KEYS[1])
            local timeToExpire = redis.call("PTTL", KEYS[1])
            return { totalHits, timeToExpire }
        `.replaceAll(/^\s+/gm, '').trim();
        const key = 'test:get';
        await redis.del(key);

        // Sin valor previo: GET devuelve null, tratado como 0
        const empty = await (redis as any).call('EVAL', getScript, '1', key);
        expect(empty[0]).toBe(0);
        expect(empty[1]).toBe(-2);

        // Pongo un valor y verifico
        await (redis as any).call('SET', key, '7', 'PX', 30000);
        const result = await (redis as any).call('EVAL', getScript, '1', key);
        // `get` lee Number(get || 0), por lo que `7` se almacena como
        // string "7" pero el script lo convierte a 7.
        expect(result[0]).toBe(7);
        expect(result[1]).toBeGreaterThan(0);
        expect(result[1]).toBeLessThanOrEqual(30000);
    });

    it('EVALSHA usa el script previamente cargado por SCRIPT LOAD', async () => {
        // Cargamos uno de los scripts soportados por MockRedis (el
        // `get` script) y lo invocamos vía EVALSHA. El mock
        // identifica el script por el cuerpo, no por SHA1 real, así
        // que la verificación es funcional.
        const getScript = `
            local totalHits = redis.call("GET", KEYS[1])
            local timeToExpire = redis.call("PTTL", KEYS[1])
            return { totalHits, timeToExpire }
        `.replaceAll(/^\s+/gm, '').trim();
        const key = 'test:evalsha';
        await redis.del(key);
        await (redis as any).call('SET', key, '42', 'PX', 30000);

        const sha = await (redis as any).call('SCRIPT', 'LOAD', getScript);
        const result = await (redis as any).call('EVALSHA', sha, '1', key);
        expect(Array.isArray(result)).toBe(true);
        expect(result[0]).toBe(42);
        expect(result[1]).toBeGreaterThan(0);

        // EVALSHA con SHA desconocido: devuelve null (señal al
        // caller para que haga fallback a EVAL).
        await (redis as any).call('DEL', 'unknown-key');
        const unknown = await (redis as any).call('EVALSHA', '0'.repeat(40), '1', 'unknown-key');
        expect(unknown).toBeNull();
    });

    it('comandos individuales: INCR/GET/SET/DEL/EXPIRE/PEXPIRE/TTL/PTTL', async () => {
        const key = 'test:incr';
        await redis.del(key);

        // INCR desde 0
        expect(await (redis as any).call('INCR', key)).toBe(1);
        expect(await (redis as any).call('INCR', key)).toBe(2);

        // GET: el valor se almacena crudo. INCR lo incrementa como
        // número, pero GET devuelve el raw.
        expect(await (redis as any).call('GET', key)).toBe(2);

        // SET reemplaza. El valor se guarda crudo (string "99").
        await (redis as any).call('SET', key, '99');
        // GET devuelve el raw (string), coherente con ioredis.
        expect(await (redis as any).call('GET', key)).toBe('99');
        // INCR sobre un string numérico funciona (Number() interno)
        expect(await (redis as any).call('INCR', key)).toBe(100);

        // DEL
        expect(await (redis as any).call('DEL', key)).toBe(1);
        expect(await (redis as any).call('GET', key)).toBeNull();

        // PEXPIRE / PTTL (en milisegundos)
        await (redis as any).call('SET', key, '1', 'PX', 5000);
        const pttl = await (redis as any).call('PTTL', key);
        expect(pttl).toBeGreaterThan(4000);
        expect(pttl).toBeLessThanOrEqual(5000);

        // EXPIRE / TTL (en segundos)
        await (redis as any).call('SET', key, '2', 'EX', 60);
        const ttl = await (redis as any).call('TTL', key);
        expect(ttl).toBeGreaterThan(50);
        expect(ttl).toBeLessThanOrEqual(60);
    });

    it('SET soporta tanto EX (segundos) como PX (milisegundos) — args como string', async () => {
        // Caso real: rate-limit-redis envía los args como string
        // cuando viene de `redis.call(...)`.
        const keyEx = 'test:set-ex';
        const keyPx = 'test:set-px';
        await redis.del(keyEx);
        await redis.del(keyPx);

        await (redis as any).call('SET', keyEx, 'v', 'EX', '30');
        await (redis as any).call('SET', keyPx, 'v', 'PX', '30000');

        const ttlEx = await (redis as any).call('TTL', keyEx);
        const ttlPx = await (redis as any).call('TTL', keyPx);

        expect(ttlEx).toBeGreaterThan(20);
        expect(ttlEx).toBeLessThanOrEqual(30);
        // 30000 ms = 30 s en TTL (conversión normal)
        expect(ttlPx).toBeGreaterThan(20);
        expect(ttlPx).toBeLessThanOrEqual(30);
    });

    it('PING responde PONG', async () => {
        expect(await (redis as any).call('PING')).toBe('PONG');
    });

    it('comando desconocido lanza error explícito', async () => {
        await expect((redis as any).call('NOT_A_REAL_COMMAND', 'foo'))
            .rejects.toThrow(/comando no soportado/);
    });
});
