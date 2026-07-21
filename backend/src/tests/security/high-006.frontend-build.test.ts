// HIGH-006: el frontend debe compilar. El bug original era
// `Reports.tsx` importando `buildRequestParams` desde
// `reportHelpers.ts`, donde la función no estaba exportada.
//
// El fix: re-exportar `buildRequestParams` desde
// `reportHelpers.ts` (la implementación canónica vive en
// `reportDataProcessing.ts` para evitar ciclos de imports).
//
// Este test hace un análisis estático: si alguien elimina la
// re-export, falla. Para la verificación end-to-end, el job
// `frontend-build` de CI ejecuta `cd frontend && npm run build`.

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');
const FRONTEND_SRC = path.join(ROOT, 'frontend/src');

describe('HIGH-006 — Frontend build integrity', () => {
    it('Reports.tsx importa buildRequestParams (uso coherente)', () => {
        const src = fs.readFileSync(
            path.join(FRONTEND_SRC, 'pages/Reports.tsx'),
            'utf8'
        );
        // El componente usa buildRequestParams en al menos un sitio
        expect(src).toMatch(/buildRequestParams\s*\(/);
        // Y lo importa explícitamente
        expect(src).toMatch(/import\s*\{[^}]*buildRequestParams[^}]*\}\s*from/);
    });

    it('reportHelpers.ts re-exporta buildRequestParams', () => {
        // El fix del HIGH-006: reportHelpers re-exporta la
        // función para que el import en Reports.tsx no rompa
        // el build. Si alguien elimina la re-export, el build
        // del frontend falla con "is not exported".
        const src = fs.readFileSync(
            path.join(FRONTEND_SRC, 'features/reports/reportHelpers.ts'),
            'utf8'
        );
        expect(src).toMatch(/export\s*\{\s*buildRequestParams\s*\}\s*from\s+['"]\.\/reportDataProcessing['"]/);
    });

    it('reportDataProcessing.ts define buildRequestParams (implementación canónica)', () => {
        const src = fs.readFileSync(
            path.join(FRONTEND_SRC, 'features/reports/reportDataProcessing.ts'),
            'utf8'
        );
        expect(src).toMatch(/export\s+function\s+buildRequestParams/);
    });

    it('Reports.tsx importa otros helpers de reportHelpers que sí existen', () => {
        // Verifica que no hay otros imports rotos similares a
        // HIGH-006: cada `name` importado desde `reportHelpers`
        // está exportado en `reportHelpers`.
        const reports = fs.readFileSync(
            path.join(FRONTEND_SRC, 'pages/Reports.tsx'),
            'utf8'
        );
        const helpers = fs.readFileSync(
            path.join(FRONTEND_SRC, 'features/reports/reportHelpers.ts'),
            'utf8'
        );

        // Extraemos los nombres importados desde reportHelpers
        const importMatch = reports.match(/import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/features\/reports\/reportHelpers['"]/);
        if (!importMatch) {
            // Si no hay import, no hay nada que validar
            return;
        }
        const importedNames = importMatch[1]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

        // Cada nombre debe estar exportado (como function, const, type o re-export)
        for (const name of importedNames) {
            const re = new RegExp(`export\\s+(?:function|const|class|interface|type|\\{[^}]*${name}[^}]*\\})`);
            expect(re.test(helpers) || helpers.includes(`export { ${name}`) || helpers.includes(`export {\n  ${name}`) || new RegExp(`^export \\{ ${name}`, 'm').test(helpers), `Reports.tsx importa "${name}" de reportHelpers pero no se exporta`).toBe(true);
        }
    });
});
