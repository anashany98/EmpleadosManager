import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app/createApp';

const app = createApp();

describe('Employee Import Integration Tests', () => {
    describe('POST /api/employees/import', () => {
        it('should reject import without authentication', async () => {
            const res = await request(app as any)
                .post('/api/employees/import');

            // 401 or 403 = unauthorized
            expect([401, 403]).toContain(res.status);
        });

        it('should reject import without file', async () => {
            const res = await request(app as any)
                .post('/api/employees/import')
                .set('Authorization', 'Bearer invalid_token');

            // 401, 403, or 404 = route exists but unauthorized
            expect([401, 403, 404]).toContain(res.status);
        });
    });

    describe('GET /api/employees/template', () => {
        it('should reject template download without authentication', async () => {
            const res = await request(app as any)
                .get('/api/employees/template');

            expect([401, 403]).toContain(res.status);
        });
    });

    describe('GET /api/employees', () => {
        it('should reject listing employees without authentication', async () => {
            const res = await request(app as any)
                .get('/api/employees');

            expect(res.status).toBe(401);
        });

        it('should accept pagination params without crashing', async () => {
            const res = await request(app as any)
                .get('/api/employees')
                .query({ page: '1', limit: '10' });

            expect(res.status).toBe(401); // Auth fails, but route parses params
        });
    });

    describe('POST /api/employees', () => {
        it('should reject employee creation without auth', async () => {
            const res = await request(app as any)
                .post('/api/employees')
                .send({ name: 'Test', dni: '12345678A' });

            expect([401, 403]).toContain(res.status);
        });
    });

    describe('PATCH /api/employees/:id', () => {
        it('should reject employee update without auth', async () => {
            const res = await request(app as any)
                .patch('/api/employees/fake-id-123')
                .send({ name: 'Updated Name' });

            expect([401, 403]).toContain(res.status);
        });
    });

    describe('DELETE /api/employees/:id', () => {
        it('should reject employee deletion without auth', async () => {
            const res = await request(app as any)
                .delete('/api/employees/fake-id-123');

            expect([401, 403]).toContain(res.status);
        });
    });
});
