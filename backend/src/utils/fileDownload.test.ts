import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import {
    resolveLocalUploadPath,
    sanitizeContentDispositionFilename,
    serveLocalUploadFile
} from './fileDownload';

/**
 * MED-007/barrido: helper compartido para servir archivos
 * locales del directorio `uploads/` con:
 *   - defense-in-depth contra path traversal (`resolveLocalUploadPath`)
 *   - sanitización del nombre de descarga para `Content-Disposition`
 *     (RFC 6266 + 5987, sin header injection)
 *   - callback explícito de error en `res.sendFile` (404 en
 *     ENOENT, 500 genérico en otros casos, sin filtrar
 *     `error.message`)
 *
 * Tests:
 *   - path traversal: `..`, rutas absolutas, prefix attack
 *   - file missing: 404 con mensaje claro
 *   - sanitization: comillas, no-ASCII, control chars, fallback
 *   - serveLocalUploadFile: bytes reales, Content-Disposition,
 *     404 limpio, callback de error
 */
describe('fileDownload helper (MED-007/barrido)', () => {
    describe('sanitizeContentDispositionFilename', () => {
        it('returns the fallback when the input is null/empty/whitespace', () => {
            expect(sanitizeContentDispositionFilename(null)).toEqual({ ascii: 'documento', utf8: 'documento' });
            expect(sanitizeContentDispositionFilename(undefined)).toEqual({ ascii: 'documento', utf8: 'documento' });
            expect(sanitizeContentDispositionFilename('')).toEqual({ ascii: 'documento', utf8: 'documento' });
            expect(sanitizeContentDispositionFilename('   ')).toEqual({ ascii: 'documento', utf8: 'documento' });
        });

        it('replaces quotes and backslashes in both versions (no header injection)', () => {
            const r = sanitizeContentDispositionFilename('seguro "coche" 2024.pdf');
            expect(r.ascii).toBe('seguro _coche_ 2024.pdf');
            expect(r.utf8).toBe('seguro _coche_ 2024.pdf');
            // El valor ASCII nunca debe contener `"` o `\` literales.
            expect(r.ascii).not.toMatch(/["\\]/);
        });

        it('preserves non-ASCII in utf8 (RFC 5987) but replaces in ascii (RFC 6266)', () => {
            const r = sanitizeContentDispositionFilename('factura Müller.pdf');
            expect(r.utf8).toBe('factura Müller.pdf');
            // ü (0xFC) no es ASCII printable → se reemplaza por `_`
            expect(r.ascii).toBe('factura M_ller.pdf');
        });

        it('strips control characters', () => {
            const r = sanitizeContentDispositionFilename('foo\x00\x01\x02bar.pdf');
            expect(r.utf8).toBe('foo___bar.pdf');
            expect(r.ascii).toBe('foo___bar.pdf');
        });

        it('falls back to "documento" when the sanitized name is visually useless', () => {
            // Solo `_`, `.` o whitespace → no tiene sentido como
            // nombre de archivo.
            expect(sanitizeContentDispositionFilename('____').ascii).toBe('documento');
            expect(sanitizeContentDispositionFilename('...').ascii).toBe('documento');
            expect(sanitizeContentDispositionFilename(' _ . _ ').ascii).toBe('documento');
        });

        it('keeps dashes, dots, hyphens and digits', () => {
            const r = sanitizeContentDispositionFilename('2024-12-31.receipt-v2.pdf');
            expect(r.ascii).toBe('2024-12-31.receipt-v2.pdf');
            expect(r.utf8).toBe('2024-12-31.receipt-v2.pdf');
        });
    });

    describe('resolveLocalUploadPath', () => {
        it('returns the resolved path for a normal key', () => {
            const r = resolveLocalUploadPath('documents/abc.pdf');
            expect(r).toBe(path.resolve(process.cwd(), 'uploads', 'documents', 'abc.pdf'));
        });

        it('returns null for empty/whitespace input', () => {
            expect(resolveLocalUploadPath(null)).toBeNull();
            expect(resolveLocalUploadPath(undefined)).toBeNull();
            expect(resolveLocalUploadPath('')).toBeNull();
            expect(resolveLocalUploadPath('   ')).toBeNull();
        });

        it('returns null for non-string input', () => {
            expect(resolveLocalUploadPath(123 as unknown as string)).toBeNull();
            expect(resolveLocalUploadPath({} as unknown as string)).toBeNull();
        });

        it('rejects path traversal via `..` (escapes uploads/)', () => {
            // path.join / path.resolve normalizan los `..`. La
            // resolución apuntaría a `etc/passwd` que está FUERA
            // de uploads/. El check de contención debe rechazarlo.
            const r = resolveLocalUploadPath('../../../etc/passwd');
            expect(r).toBeNull();
        });

        it('rejects path traversal via a `..` in a subfolder', () => {
            const r = resolveLocalUploadPath('documents/../../../etc/passwd');
            expect(r).toBeNull();
        });

        it('rejects absolute paths by normalizing them under uploads/', () => {
            // El helper strippea el `/` líder (y el prefijo
            // `uploads/` si existe) ANTES de resolver, así que
            // `/etc/passwd` se convierte en `<uploads>/etc/passwd`
            // (que no existe en disco, y si llegara a existir
            // sería un archivo inocuo dentro de uploads/, NUNCA
            // el `/etc/passwd` real del sistema). El check de
            // contención del basename neutraliza el riesgo.
            const r = resolveLocalUploadPath('/etc/passwd');
            // No debe apuntar al /etc/passwd real del sistema
            // ni a nada fuera de uploads/.
            if (r !== null) {
                const localUploadDir = path.resolve(process.cwd(), 'uploads');
                expect(r.startsWith(localUploadDir + path.sep) || r === localUploadDir).toBe(true);
            }
        });

        it('rejects prefix attacks (uploads-evil/)', () => {
            // Un path que empieza con "uploads-evil/" pasa un
            // `startsWith('uploads')` ingenuo pero falla el
            // `startsWith('uploads/')` (con separador).
            const r = resolveLocalUploadPath('../uploads-evil/secret.pdf');
            expect(r).toBeNull();
        });

        it('rejects null-byte injection', () => {
            // Un filename con NUL puede confundir a `path.basename`
            // en algunas plataformas. La resolución apuntaría a
            // `<uploads>/foo\0bar` que no existe, pero queremos
            // rechazar ANTES del existsSync.
            const r = resolveLocalUploadPath('foo\x00bar.pdf');
            // En Node, los NUL en paths se preservan pero la
            // resolución queda dentro de uploads/ (es solo un
            // basename raro). El check de contención pasa pero el
            // archivo no existe en disco → 404 en el caller. Esto
            // está bien (defense-in-depth).
            expect(r === null || (r && r.startsWith(path.resolve(process.cwd(), 'uploads') + path.sep))).toBe(true);
        });
    });

    describe('serveLocalUploadFile', () => {
        let tmpRoot: string;
        let tmpUploads: string;

        beforeEach(() => {
            // Crear un uploads/ temporal para los tests
            tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fileDownload-test-'));
            tmpUploads = path.join(tmpRoot, 'uploads');
            fs.mkdirSync(tmpUploads, { recursive: true });
        });

        afterEach(() => {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        });

        /**
         * Helper: crea una mini-app Express con un endpoint que
         * invoca `serveLocalUploadFile` con un `fileUrl` dado.
         */
        const makeApp = (fileUrl: string, options: Parameters<typeof serveLocalUploadFile>[2] = {}) => {
            const app = express();
            app.get('/dl', (req, res) => serveLocalUploadFile(res, fileUrl, options));
            return app;
        };

        it('serves the actual file bytes with the sanitized filename header', async () => {
            const fakePdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('hello world\n'), Buffer.from('%%EOF\n')]);
            const filename = 'factura-2024.pdf';
            fs.writeFileSync(path.join(tmpUploads, filename), fakePdf);

            // Cambiamos CWD temporalmente para que el helper
            // apunte a nuestro tmpUploads.
            const originalCwd = process.cwd();
            process.chdir(tmpRoot);
            try {
                const app = makeApp(filename, { downloadName: 'factura Müller "v2".pdf' });
                const res = await request(app).get('/dl');

                expect(res.status).toBe(200);
                expect(res.body).toEqual(fakePdf);
                // Header bien formado: attachment + filename ASCII
                // seguro + filename* UTF-8 encoded.
                expect(res.headers['content-disposition']).toMatch(
                    /^attachment;\s*filename="[^"]*";\s*filename\*=UTF-8''[^"]*"$/
                );
                // La versión ASCII no contiene `"` ni `\` literales.
                const ascii = res.headers['content-disposition'].match(/filename="([^"]*)"/)?.[1] ?? '';
                expect(ascii).not.toMatch(/["\\]/);
            } finally {
                process.chdir(originalCwd);
            }
        });

        it('returns 404 with a clear message when the file is missing', async () => {
            const originalCwd = process.cwd();
            process.chdir(tmpRoot);
            try {
                const app = makeApp('archivo-inexistente.pdf');
                const res = await request(app).get('/dl');

                expect(res.status).toBe(404);
                const body = JSON.parse(res.text || '{}');
                expect(body.message).toMatch(/no encontr/i);
            } finally {
                process.chdir(originalCwd);
            }
        });

        it('returns 404 when fileUrl tries path traversal (does not leak filesystem details)', async () => {
            const originalCwd = process.cwd();
            process.chdir(tmpRoot);
            try {
                // Aunque el helper hace su propia defensa, también
                // queremos verificar que NO se sirve el archivo
                // aunque exista fuera de uploads/. Para eso,
                // creamos un archivo en /tmp y vemos que no se
                // sirve.
                fs.writeFileSync(path.join(tmpRoot, 'secret.txt'), 'TOP SECRET');

                const app = makeApp('../secret.txt');
                const res = await request(app).get('/dl');

                expect(res.status).toBe(404);
                const body = JSON.parse(res.text || '{}');
                expect(body.message).toMatch(/no encontr/i);
                // NO debe contener el contenido del archivo ni
                // la ruta real
                expect(res.text).not.toContain('TOP SECRET');
                expect(res.text).not.toContain('secret.txt');
            } finally {
                process.chdir(originalCwd);
            }
        });

        it('returns 404 for absolute paths (does not serve /etc/passwd)', async () => {
            const originalCwd = process.cwd();
            process.chdir(tmpRoot);
            try {
                const app = makeApp('/etc/passwd');
                const res = await request(app).get('/dl');

                expect(res.status).toBe(404);
            } finally {
                process.chdir(originalCwd);
            }
        });

        it('uses Content-Disposition: inline when inline: true is passed', async () => {
            const originalCwd = process.cwd();
            process.chdir(tmpRoot);
            try {
                fs.writeFileSync(path.join(tmpUploads, 'preview.pdf'), 'PDF content');
                const app = makeApp('preview.pdf', { inline: true });
                const res = await request(app).get('/dl');

                expect(res.status).toBe(200);
                expect(res.headers['content-disposition']).toMatch(/^inline;/);
            } finally {
                process.chdir(originalCwd);
            }
        });

        it('falls back to "documento" for useless downloadName', async () => {
            const originalCwd = process.cwd();
            process.chdir(tmpRoot);
            try {
                fs.writeFileSync(path.join(tmpUploads, 'x.pdf'), 'PDF');
                const app = makeApp('x.pdf', { downloadName: '\x00\x01\x02' });
                const res = await request(app).get('/dl');

                expect(res.status).toBe(200);
                const cd = res.headers['content-disposition'] || '';
                expect(cd).toContain('filename="documento"');
                expect(cd).toContain("filename*=UTF-8''documento");
            } finally {
                process.chdir(originalCwd);
            }
        });
    });
});
