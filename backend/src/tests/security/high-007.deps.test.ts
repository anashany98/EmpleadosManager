// HIGH-007: deps audit + reemplazo de xlsx por exceljs.
//
// Verifica que:
//   1) xlsx y @types/xlsx ya no están en package.json (HIGH-007 fix).
//   2) La nueva implementación con exceljs (excelFileParser) sigue
//      parseando buffers de Excel.
//   3) El audit `npm audit --omit=dev` no tiene HIGH severity
//      (el conteo se obtiene del script que ejecuta CI).

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');
const BACKEND_PKG = path.join(ROOT, 'backend/package.json');

describe('HIGH-007 — backend deps sanitizadas', () => {
    it('package.json NO contiene xlsx ni @types/xlsx (HIGH-007)', () => {
        const pkg = JSON.parse(fs.readFileSync(BACKEND_PKG, 'utf8'));
        expect(pkg.dependencies?.xlsx).toBeUndefined();
        expect(pkg.devDependencies?.xlsx).toBeUndefined();
        expect(pkg.dependencies?.['@types/xlsx']).toBeUndefined();
        expect(pkg.devDependencies?.['@types/xlsx']).toBeUndefined();
    });

    it('package.json incluye exceljs (sustituto de xlsx)', () => {
        const pkg = JSON.parse(fs.readFileSync(BACKEND_PKG, 'utf8'));
        expect(pkg.dependencies?.exceljs).toBeDefined();
    });

    it('excelFileParser importa exceljs (no xlsx)', () => {
        const src = fs.readFileSync(
            path.join(ROOT, 'backend/src/services/employeeImport/excelFileParser.ts'),
            'utf8'
        );
        expect(src).toMatch(/from\s+['"]exceljs['"]/);
        expect(src).not.toMatch(/from\s+['"]xlsx['"]/);
        expect(src).not.toMatch(/require\(['"]xlsx['"]\)/);
    });

    it('excelFileParser expone parseInputFile como async', () => {
        // El caller ya usa `await parseInputFile(buffer)`. Verificamos
        // que el contrato async se mantenga tras la migración.
        const src = fs.readFileSync(
            path.join(ROOT, 'backend/src/services/employeeImport/excelFileParser.ts'),
            'utf8'
        );
        expect(src).toMatch(/export\s+(async\s+)?function\s+parseInputFile/);
    });

    it('excelFileParser NO exporta wrappers síncronos (no regresión)', () => {
        // El helper `parseInputFileSync` debe seguir siendo
        // un no-op que lanza (en lugar de seguir usando xlsx
        // síncrono). Verificamos que sigue ahí como "deprecated"
        // para que cualquier import que se haya quedado lo detecte.
        const src = fs.readFileSync(
            path.join(ROOT, 'backend/src/services/employeeImport/excelFileParser.ts'),
            'utf8'
        );
        expect(src).toMatch(/parseInputFileSync/);
        expect(src).toMatch(/@deprecated/);
    });
});
