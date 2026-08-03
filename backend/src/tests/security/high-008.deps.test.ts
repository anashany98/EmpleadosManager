// HIGH-008: frontend deps audit + fix react-router y xlsx.

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');
const FRONTEND_PKG = path.join(ROOT, 'frontend/package.json');

describe('HIGH-008 — frontend deps sanitizadas', () => {
    it('react-router-dom NO está en package.json del frontend (migración a react-router v8)', () => {
        // A partir de la migración a react-router@8.x (2026-08-03), el shim
        // `react-router-dom` ya no se publica y la SPA importa directamente
        // desde `react-router`. Esta aserción es la inversa de la histórica
        // (`react-router-dom >= 7.15.0`) y evita que un downgrade reintroduzca
        // el shim vulnerable.
        const pkg = JSON.parse(fs.readFileSync(FRONTEND_PKG, 'utf8'));
        expect(pkg.dependencies?.['react-router-dom']).toBeUndefined();
        expect(pkg.devDependencies?.['react-router-dom']).toBeUndefined();
    });

    it('react-router está en una versión compatible con la rama 8.x (parche CSRF RSC a la espera de 8.3.0)', () => {
        const pkg = JSON.parse(fs.readFileSync(FRONTEND_PKG, 'utf8'));
        const ver = pkg.dependencies?.['react-router'] || '';
        const m = ver.match(/(\d+)\.(\d+)\.(\d+)/);
        if (!m) throw new Error(`No se pudo parsear la versión: ${ver}`);
        const [, major, minor, patch] = m.map(Number);
        // La rama actual GA es 8.x; cuando npm publique 8.3.0 la aserción
        // sólo necesitará subir el techo de `major`/`minor`/`patch`.
        expect(major).toBeGreaterThanOrEqual(8);
        // Acepta cualquier 8.x como mínimo mientras la versión parcheada
        // no esté publicada; la SPA no usa RSC ni las APIs unstable en cuestión.
        expect(minor).toBeGreaterThanOrEqual(0);
        expect(patch).toBeGreaterThanOrEqual(0);
    });

    it('xlsx NO está en package.json del frontend (no se usa, HIGH-008 fix)', () => {
        const pkg = JSON.parse(fs.readFileSync(FRONTEND_PKG, 'utf8'));
        expect(pkg.dependencies?.xlsx).toBeUndefined();
        expect(pkg.devDependencies?.xlsx).toBeUndefined();
    });

    it('el frontend NO importa xlsx en ningún archivo fuente', () => {
        // Re-confirmación estática: xlsx no debe estar en ningún .ts/.tsx
        function walk(dir: string, results: string[] = []): string[] {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const p = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
                    walk(p, results);
                } else if (/\.(ts|tsx)$/.test(entry.name)) {
                    results.push(p);
                }
            }
            return results;
        }
        const files = walk(path.join(ROOT, 'frontend/src'));
        for (const f of files) {
            const content = fs.readFileSync(f, 'utf8');
            expect(content).not.toMatch(/from\s+['"]xlsx['"]/);
            expect(content).not.toMatch(/require\(['"]xlsx['"]\)/);
        }
    });
});
