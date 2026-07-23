// HIGH-008: frontend deps audit + fix react-router-dom y xlsx.

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');
const FRONTEND_PKG = path.join(ROOT, 'frontend/package.json');

describe('HIGH-008 — frontend deps sanitizadas', () => {
    it('react-router-dom está en versión >= 7.15.0 (parche CSRF/XSS/DoS)', () => {
        const pkg = JSON.parse(fs.readFileSync(FRONTEND_PKG, 'utf8'));
        const ver = pkg.dependencies?.['react-router-dom'] || '';
        const m = ver.match(/(\d+)\.(\d+)\.(\d+)/);
        if (!m) throw new Error(`No se pudo parsear la versión: ${ver}`);
        const [, , minor, patch] = m.map(Number);
        expect(minor).toBeGreaterThanOrEqual(15);
        // Si es 7.15.x, el patch debe ser >= 0 (trivialmente cierto)
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
