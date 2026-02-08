import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validateResource } from './validateResource';
import { Request, Response, NextFunction } from 'express';

describe('validateResource Middleware', () => {
    it('should call next() when validation succeeds', async () => {
        const schema = z.object({
            body: z.object({
                name: z.string(),
            }),
        });

        const req = {
            body: { name: 'Juan' },
            query: {},
            params: {},
        } as Request;
        const res = {} as Response;
        const next = vi.fn();

        await validateResource(schema)(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('should strip unknown fields from body', async () => {
        const schema = z.object({
            body: z.object({
                name: z.string(),
            }),
        });

        const req = {
            body: { name: 'Juan', hackerField: 'hacked' },
            query: {},
            params: {},
        } as Request;
        const res = {} as Response;
        const next = vi.fn();

        await validateResource(schema)(req, res, next);

        expect(req.body).toEqual({ name: 'Juan' });
        expect((req.body as any).hackerField).toBeUndefined();
    });

    it('should return 400 when validation fails', async () => {
        const schema = z.object({
            body: z.object({
                age: z.number(),
            }),
        });

        const req = {
            body: { age: 'not a number' }, // Invalid type
            query: {},
            params: {},
        } as Request;

        const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        } as unknown as Response;
        const next = vi.fn();

        await validateResource(schema)(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
            message: 'Error de validación'
        }));
    });
});
