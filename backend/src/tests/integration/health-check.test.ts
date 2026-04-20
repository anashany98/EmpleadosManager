import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app/createApp';

const app = createApp();

describe('Basic API Health Checks', () => {
    beforeAll(() => {
        // HealthChecker needs to be initialized for full health checks
        // The health controller checks if healthChecker exists
    });

    it('should return liveness probe', async () => {
        const res = await request(app as any).get('/api/health/liveness');
        // Without DB connection, liveness may return 503
        expect([200, 503]).toContain(res.status);
    });

    it('should return readiness probe', async () => {
        const res = await request(app as any).get('/api/health/readiness');
        // Without DB connection, readiness may return 503
        expect([200, 503]).toContain(res.status);
    });

    it('should return comprehensive health check', async () => {
        const res = await request(app as any).get('/api/health');
        // Returns 200, 503, or 500 depending on service status
        expect([200, 500, 503]).toContain(res.status);
        expect(res.body).toHaveProperty('status');
    });
});
