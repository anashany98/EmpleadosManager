import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import { AppError } from './AppError';
import { handleControllerError } from './controllerError';

/**
 * MED-007: el helper central de errores de controller debe
 * censurar la información sensible en respuestas 5xx. La fuga de
 * `error.message` en producción es lo que el audit doc
 * (MED-007) y OWASP A09 llaman "verbose error messages": un
 * atacante provoca un error (Prisma unique constraint, file
 * system, etc.) y ve en la respuesta detalles internos que le
 * ayudan a mapear el backend.
 */
describe('handleControllerError (MED-007)', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    let app: express.Express;

    beforeEach(() => {
        app = express();
        // Endpoint dummy que invoca el helper con un error
        // controlable.
        app.get('/throw/:kind', (req, res) => {
            const kind = req.params.kind;
            let err: unknown;
            switch (kind) {
                case 'app-error':
                    err = new AppError('Cuenta comprometida', 401);
                    break;
                case 'prisma-p2002':
                    err = new Prisma.PrismaClientKnownRequestError(
                        'Unique constraint failed on (`.public.employees.email`)',
                        { code: 'P2002', clientVersion: '5.0.0', meta: { target: ['email'] } }
                    );
                    break;
                case 'prisma-p2025':
                    err = new Prisma.PrismaClientKnownRequestError(
                        'Record not found',
                        { code: 'P2025', clientVersion: '5.0.0' }
                    );
                    break;
                case 'fs-error':
                    err = new Error("ENOENT: no such file or directory, open '/etc/passwd'");
                    break;
                case 'sql-error':
                    err = new Error('PrismaClientKnownRequestError: Invalid `prisma.employee.findMany()` invocation: Query 해석기');
                    break;
                case 'status-code-error':
                    err = Object.assign(new Error('Custom 503 with leak: /var/secrets/db.password'), { statusCode: 503 });
                    break;
                case 'string-error':
                    err = 'just a string';
                    break;
                default:
                    err = new Error('Unknown');
            }
            return handleControllerError(res, err, 'Error genérico del servidor');
        });
    });

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    describe('AppError passthrough', () => {
        it('returns the AppError message and status code as-is (safe by contract)', async () => {
            const res = await request(app).get('/throw/app-error');
            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Cuenta comprometida');
            expect(res.body.success).toBe(false);
            // AppError no censura, pero igualmente devolvemos
            // correlation ID para que el usuario lo reporte.
            expect(res.body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
            expect(res.headers['x-request-id']).toBe(res.body.correlationId);
        });
    });

    describe('Prisma unique constraint (P2002)', () => {
        it('translates to 400 with a generic "duplicate" message (no schema leak)', async () => {
            const res = await request(app).get('/throw/prisma-p2002');
            expect(res.status).toBe(400);
            // El mensaje NO debe contener detalles del schema
            // (columna, tabla, etc.)
            expect(res.body.message).toBe('Ya existe un registro con esos datos únicos.');
            expect(res.body.message).not.toContain('email');
            expect(res.body.message).not.toContain('employees');
            expect(res.body.message).not.toContain('P2002');
            expect(res.body.correlationId).toBeDefined();
        });
    });

    describe('Prisma other errors (P2025 etc)', () => {
        it('logs the full error and returns the generic fallback (no Prisma leak)', async () => {
            process.env.NODE_ENV = 'production';
            const res = await request(app).get('/throw/prisma-p2025');
            expect(res.status).toBe(500);
            expect(res.body.message).toBe('Error genérico del servidor');
            // NO debe filtrarse el código de Prisma ni la
            // descripción original.
            expect(res.body.message).not.toContain('P2025');
            expect(res.body.message).not.toContain('Record not found');
            expect(res.body.correlationId).toBeDefined();
        });
    });

    describe('File system errors in production', () => {
        it('does NOT leak the file path in the response', async () => {
            process.env.NODE_ENV = 'production';
            const res = await request(app).get('/throw/fs-error');
            expect(res.status).toBe(500);
            expect(res.body.message).toBe('Error genérico del servidor');
            // El path interno NO debe aparecer en la respuesta.
            expect(res.body.message).not.toContain('/etc/passwd');
            expect(res.body.message).not.toContain('ENOENT');
        });
    });

    describe('SQL / Prisma messages in production', () => {
        it('does NOT leak the SQL or Prisma details', async () => {
            process.env.NODE_ENV = 'production';
            const res = await request(app).get('/throw/sql-error');
            expect(res.status).toBe(500);
            expect(res.body.message).toBe('Error genérico del servidor');
            expect(res.body.message).not.toContain('Prisma');
            expect(res.body.message).not.toContain('invocation');
            expect(res.body.message).not.toContain('해석기');
        });
    });

    describe('Custom status-code error (defensive)', () => {
        it('uses the error.statusCode if present but still censors the message', async () => {
            process.env.NODE_ENV = 'production';
            const res = await request(app).get('/throw/status-code-error');
            // statusCode del error: 503 → usamos eso
            expect(res.status).toBe(503);
            expect(res.body.message).toBe('Error genérico del servidor');
            expect(res.body.message).not.toContain('/var/secrets');
            expect(res.body.message).not.toContain('db.password');
        });
    });

    describe('Non-Error throw (string)', () => {
        it('handles a thrown string defensively', async () => {
            const res = await request(app).get('/throw/string-error');
            expect(res.status).toBe(500);
            expect(res.body.message).toBe('Error genérico del servidor');
            expect(res.body.correlationId).toBeDefined();
        });
    });

    describe('Development mode', () => {
        it('exposes the raw error message for easier debugging when not in production', async () => {
            process.env.NODE_ENV = 'development';
            const res = await request(app).get('/throw/fs-error');
            // En dev SÍ vemos el mensaje raw para debugging.
            expect(res.body.message).toContain('ENOENT');
            // (Esto es seguro en dev porque el código no está
            // expuesto públicamente.)
        });
    });

    describe('Correlation ID', () => {
        it('returns a correlation ID in the body and as the X-Request-Id header', async () => {
            const res = await request(app).get('/throw/app-error');
            expect(res.body.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
            expect(res.headers['x-request-id']).toBe(res.body.correlationId);
        });

        it('uses a provided correlation ID if one is passed', async () => {
            const fixed = 'fixed-correlation-1234';
            const app2 = express();
            app2.get('/x', (_req, res) =>
                handleControllerError(res, new Error('test'), 'fallback', { correlationId: fixed })
            );
            const res = await request(app2).get('/x');
            expect(res.body.correlationId).toBe(fixed);
            expect(res.headers['x-request-id']).toBe(fixed);
        });
    });
});
