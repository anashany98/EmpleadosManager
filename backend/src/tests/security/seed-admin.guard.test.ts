// HIGH-011: El script `seed-admin.ts` debe abortar si no se
// proporciona `SEED_ADMIN_PASSWORD` o si la contraseña es débil.
// Nunca debe tener un fallback hardcodeado que cree un admin
// sin ceremonia.

import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

describe('HIGH-011 — seed-admin.ts safeguards', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let processExitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        processExitSpy.mockRestore();
        vi.restoreAllMocks();
    });

    describe('Análisis estático del código fuente', () => {
        // La verificación de safeguards es más fiable como análisis
        // estático: el script es pequeño, no requiere BD, y nos
        // protege contra cualquier refactor que reintroduzca un
        // fallback inseguro. Las pruebas dinámicas de `process.exit`
        // son frágiles con el patrón IIFE.

        it('lee SEED_ADMIN_PASSWORD como fuente principal (no solo ADMIN_INITIAL_PASSWORD)', () => {
            const src = fs.readFileSync(
                path.resolve(__dirname, '../../scripts/seed-admin.ts'),
                'utf8'
            );
            expect(src).toMatch(/SEED_ADMIN_PASSWORD/);
        });

        it('aborta explícitamente si la contraseña es débil o no se proporciona', () => {
            const src = fs.readFileSync(
                path.resolve(__dirname, '../../scripts/seed-admin.ts'),
                'utf8'
            );
            // Debe comprobar longitud mínima y/o valor sentinela
            expect(src).toMatch(/length\s*<\s*8|CHANGE_ME_IN_PRODUCTION/);
            expect(src).toMatch(/process\.exit\(1\)/);
            expect(src).toMatch(/FATAL|Password too weak|SEED_ADMIN_PASSWORD/i);
        });

        it('NO contiene un fallback hardcodeado tipo `|| "MiPass2026!"`', () => {
            const src = fs.readFileSync(
                path.resolve(__dirname, '../../scripts/seed-admin.ts'),
                'utf8'
            );
            // Patrón: literal con aspecto de contraseña (>=6 chars
            // de letras/dígitos/símbolos) encadenado con || a una
            // variable de entorno. Aceptamos sentinels explícitos
            // que el script aborta (CHANGE_ME_*, REPLACE_ME_*,
            // YOUR_*_HERE, etc.).
            const dangerousFallback = /\|\|\s*['"](?![A-Z_]*(?:CHANGE|REPLACE|EXAMPLE|YOUR|PLACEHOLDER|SET_ME)[A-Z_]*['"])[A-Za-z0-9!@#$%^&*()_+=-]{6,}['"]/i;
            expect(src).not.toMatch(dangerousFallback);
            // Mismo patrón con ??
            const nullishFallback = /\?\?\s*['"](?![A-Z_]*(?:CHANGE|REPLACE|EXAMPLE|YOUR|PLACEHOLDER|SET_ME)[A-Z_]*['"])[A-Za-z0-9!@#$%^&*()_+=-]{6,}['"]/i;
            expect(src).not.toMatch(nullishFallback);
        });

        it('usa bcrypt con rondas configurables (getBcryptRounds), no un literal', () => {
            const src = fs.readFileSync(
                path.resolve(__dirname, '../../scripts/seed-admin.ts'),
                'utf8'
            );
            // Debe importar getBcryptRounds para que el coste del
            // hash siga la política del proyecto.
            expect(src).toMatch(/getBcryptRounds/);
            // No debe usar `bcrypt.hash(pwd, 10)` directo (hardcoded rounds)
            expect(src).not.toMatch(/bcrypt\.hash\([^)]*,\s*10\s*\)/);
        });
    });

    describe('Barrido de archivos de seed inseguros', () => {
        it('NO existe scripts/seed-admin-inline.js (fallback con contraseña literal)', () => {
            const risky = path.resolve(__dirname, '../../../scripts/seed-admin-inline.js');
            expect(fs.existsSync(risky)).toBe(false);
        });

        it('NO existe scripts/*.js con `||` aplicado a literales de contraseña', () => {
            // Defensa en profundidad: aunque introduzcamos un nuevo
            // script, este test detecta el patrón peligroso.
            const scriptsDir = path.resolve(__dirname, '../../../scripts');
            if (!fs.existsSync(scriptsDir)) return;
            const files = fs.readdirSync(scriptsDir).filter((f) => f.endsWith('.js'));
            for (const f of files) {
                const content = fs.readFileSync(path.join(scriptsDir, f), 'utf8');
                // Cualquiera de estos patrones en un script .js es
                // señal de un fallback inseguro.
                const pattern = /\|\|\s*['"][A-Za-z0-9!@#$%^&*()_+=-]{6,}['"]/;
                if (pattern.test(content)) {
                    throw new Error(`Script inseguro detectado: ${f} contiene un fallback de contraseña hardcodeado`);
                }
            }
        });
    });
});
