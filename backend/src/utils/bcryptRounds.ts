/**
 * Fuente única de verdad para los rounds de bcrypt.
 *
 * Hasta ahora había tres copias literales (`PasswordController`,
 * `UserController`, `create_admin.ts`) y once scripts de seed con `10`
 * hardcodeado. Subir el coste de hash en producción requería editar
 * varios archivos. Esta utilidad centraliza el valor.
 *
 * Uso:
 *   import { getBcryptRounds } from '../utils/bcryptRounds';
 *   await bcrypt.hash(password, getBcryptRounds());
 *
 * Variables de entorno:
 *   - BCRYPT_ROUNDS (entero >= 4, por defecto 10 en dev, recomendado 12 en prod)
 *
 * El valor se evalúa una sola vez al primer import del módulo (memoización
 * simple). No es crítico porque parseInt es barato, pero evita lecturas
 * repetidas de process.env y mantiene un punto de instrumentación futuro
 * (logging, métricas).
 */

const DEFAULT_ROUNDS = 10;
const MIN_ROUNDS = 4;
const MAX_ROUNDS = 15; // Por encima de 15 los hashes tardan >30s incluso en hardware moderno

let cachedRounds: number | undefined;

function resolveRounds(): number {
    const raw = process.env.BCRYPT_ROUNDS;
    if (!raw) return DEFAULT_ROUNDS;

    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < MIN_ROUNDS) {
        // No fallamos en producción para no romper despliegues: caemos al
        // default y dejamos huella en consola para que se note en logs.
        // Para un fail-fast estricto, sustituye este bloque por un throw.
        // eslint-disable-next-line no-console
        console.warn(
            `[bcryptRounds] BCRYPT_ROUNDS inválido ('${raw}'), usando ${DEFAULT_ROUNDS}. ` +
            `Rango permitido: ${MIN_ROUNDS}-${MAX_ROUNDS}.`
        );
        return DEFAULT_ROUNDS;
    }

    if (parsed > MAX_ROUNDS) {
        // eslint-disable-next-line no-console
        console.warn(
            `[bcryptRounds] BCRYPT_ROUNDS=${parsed} es muy alto (máx ${MAX_ROUNDS}), ` +
            `ajustando a ${MAX_ROUNDS}.`
        );
        return MAX_ROUNDS;
    }

    return parsed;
}

export function getBcryptRounds(): number {
    if (cachedRounds === undefined) {
        cachedRounds = resolveRounds();
    }
    return cachedRounds;
}

/**
 * Útil sólo para tests: fuerza el siguiente cómputo del helper.
 * No usar en código de producción.
 */
export function __resetBcryptRoundsForTests(): void {
    cachedRounds = undefined;
}
