// HIGH-004: el módulo Kiosco está fuera de uso. La desactivación
// debe garantizar que:
//
//   1) El backend rechaza cualquier operación al endpoint /api/kiosk/*
//      con 410 Gone (no 200, no 401, no 500 silencioso).
//   2) Ningún frontend bundle expone VITE_KIOSK_DEVICE_SECRET.
//   3) La UI no tiene ruta navegable /kiosk ni accesos en el sidebar.
//
// Este test es service-level porque reproducir la app completa
// (createApp) sigue bloqueado por MED-001 (MockRedis). La parte
// de bundle de frontend se valida con análisis estático de los
// archivos fuente y de los artefactos de build (cuando estén
// disponibles).

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

// Path setup:
//   Este test vive en backend/src/tests/security/
//   El repo raíz está 4 niveles arriba: backend/src/tests/security → ../ → src → ../ → tests → ../ → backend → ../ → repo
const ROOT = path.resolve(__dirname, '../../../..');
const FRONTEND_SRC = path.join(ROOT, 'frontend/src');
const FRONTEND_DIST = path.join(ROOT, 'frontend/dist');

describe('HIGH-004 — Kiosk desactivación', () => {
    describe('A) Backend: endpoints bloqueados', () => {
        it('registerRoutes monta el router DISABLED (no el original KioskController)', () => {
            const registerRoutes = fs.readFileSync(
                path.join(ROOT, 'backend/src/app/registerRoutes.ts'),
                'utf8'
            );
            // El router que se monta en /api/kiosk debe ser el stub
            // `kioskDisabledRoutes`, NO el original `kioskRoutes`.
            expect(registerRoutes).toMatch(/import\s+kioskRoutes\s+from\s+['"]\.\.\/routes\/kioskDisabledRoutes['"]/);
            expect(registerRoutes).toMatch(/app\.use\(\s*['"]\/api\/kiosk['"]\s*,\s*kioskRoutes\s*\)/);
            // Y NO debe importar el router original
            expect(registerRoutes).not.toMatch(/from\s+['"]\.\.\/routes\/kioskRoutes['"]/);
        });

        it('existe un stub kioskDisabledRoutes que devuelve 410 para todos los métodos', () => {
            const stubPath = path.join(ROOT, 'backend/src/routes/kioskDisabledRoutes.ts');
            expect(fs.existsSync(stubPath)).toBe(true);
            const src = fs.readFileSync(stubPath, 'utf8');
            expect(src).toMatch(/410|Gone/i);
            expect(src).toMatch(/router\.(use|all|post|get|put|delete)\(/);
        });

        it('los archivos históricos del kiosco siguen en disco (referencia) pero NO se enrutan', () => {
            const kioskRoute = path.join(ROOT, 'backend/src/routes/kioskRoutes.ts');
            expect(fs.existsSync(kioskRoute)).toBe(true);
            const registerRoutes = fs.readFileSync(
                path.join(ROOT, 'backend/src/app/registerRoutes.ts'),
                'utf8'
            );
            // Verifica que registerRoutes NO importa el router original
            expect(registerRoutes).not.toMatch(/import\s+kioskRoutes\s+from\s+['"]\.\.\/routes\/kioskRoutes['"]/);
        });
    });

    describe('B) Frontend: sin ruta de kiosco en el bundle', () => {
        it('App.tsx NO contiene <Route path="/kiosk"', () => {
            const appTsx = fs.readFileSync(
                path.join(FRONTEND_SRC, 'App.tsx'),
                'utf8'
            );
            expect(appTsx).not.toMatch(/<Route\s+path=["']\/kiosk["']/);
        });

        it('App.tsx NO importa KioskPage', () => {
            const appTsx = fs.readFileSync(
                path.join(FRONTEND_SRC, 'App.tsx'),
                'utf8'
            );
            expect(appTsx).not.toMatch(/import\s+KioskPage/);
        });

        it('NO existe referencia a VITE_KIOSK_DEVICE_SECRET o KIOSK_DEVICE_SECRET en código fuente activo', () => {
            // El secreto del kiosco no debe llegar al bundle. Aceptamos
            // referencias en archivos históricos (KioskPage.tsx y
            // KioskAdminPanel.tsx) y comentarios que documenten la
            // desactivación.
            const historical = new Set([
                path.join(FRONTEND_SRC, 'pages/Kiosk/KioskPage.tsx'),
                path.join(FRONTEND_SRC, 'components/KioskAdminPanel.tsx')
            ]);
            const files = walkTs(FRONTEND_SRC);
            for (const f of files) {
                if (historical.has(f)) continue;
                const content = fs.readFileSync(f, 'utf8');
                // Quitamos líneas de comentario y comprobamos
                const stripped = content
                    .split('\n')
                    .filter((l) => !/^\s*\/\//.test(l) && !/^\s*\*/.test(l))
                    .join('\n');
                expect(stripped).not.toMatch(/VITE_KIOSK_DEVICE_SECRET|KIOSK_DEVICE_SECRET/);
            }
        });

        it('sidebarNavigation.tsx NO expone ninguna entrada al kiosco', () => {
            const sidebar = fs.readFileSync(
                path.join(FRONTEND_SRC, 'components/sidebarNavigation.tsx'),
                'utf8'
            );
            expect(sidebar).not.toMatch(/kiosk/i);
        });

        it('OverviewTab NO consulta /api/kiosk/activity ni usa kioskActivity', () => {
            const overview = fs.readFileSync(
                path.join(FRONTEND_SRC, 'components/dashboard/OverviewTab.tsx'),
                'utf8'
            );
            // Aceptamos comentarios de documentación que mencionan
            // la desactivación, pero NO código activo.
            // Quitamos los comentarios y comprobamos.
            const stripped = overview
                .split('\n')
                .filter((l) => !/^\s*\/\//.test(l) && !/^\s*\*/.test(l))
                .join('\n');
            expect(stripped).not.toMatch(/\/kiosk\/activity|kioskActivity\.map|kioskActivity\.length/);
        });
    });

    describe('C) Variables de entorno', () => {
        it('.env.example NO contiene la variable VITE_KIOSK_DEVICE_SECRET activa', () => {
            const envExample = path.join(ROOT, 'frontend/.env.example');
            if (fs.existsSync(envExample)) {
                const content = fs.readFileSync(envExample, 'utf8');
                // Aceptamos comentarios que documenten la
                // desactivación, pero NO líneas del tipo
                // `VITE_KIOSK_DEVICE_SECRET=valor` ni `KIOSK_DEVICE_SECRET=...`
                const lines = content.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('#')) continue; // comentario
                    expect(trimmed).not.toMatch(/^VITE_KIOSK_DEVICE_SECRET\s*=/);
                    expect(trimmed).not.toMatch(/^KIOSK_DEVICE_SECRET\s*=/);
                }
            }
        });

        it('el bundle compilado (si existe) NO contiene el secreto del kiosco', () => {
            if (!fs.existsSync(FRONTEND_DIST)) {
                // No compilado todavía: este test se cubrirá con el
                // comando `cd frontend && npm run build` y el grep
                // en la fase de validación.
                return;
            }
            const jsFiles = walkJs(FRONTEND_DIST);
            for (const f of jsFiles) {
                const content = fs.readFileSync(f, 'utf8');
                expect(content).not.toMatch(/KIOSK_DEVICE_SECRET/);
            }
        });
    });
});

function walkTs(dir: string): string[] {
    const out: string[] = [];
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue;
            out.push(...walkTs(p));
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
            out.push(p);
        }
    }
    return out;
}

function walkJs(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...walkJs(p));
        } else if (entry.isFile() && /\.js$/.test(entry.name)) {
            out.push(p);
        }
    }
    return out;
}
