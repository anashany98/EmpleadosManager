import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app/createApp';

const { app } = createApp();

// Helper to accept both 401 and 403 (both mean unauthorized)
const expectUnauthorized = (status: number) => {
    expect([401, 403]).toContain(status);
};

describe('Document Generation Integration Tests', () => {
    describe('Document Templates', () => {
        it('should reject uniform document generation without auth', async () => {
            const res = await request(app)
                .post('/api/documents/uniform')
                .send({ employeeId: 'fake-employee-id' });

            expectUnauthorized(res.status);
        });

        it('should reject EPI document generation without auth', async () => {
            const res = await request(app)
                .post('/api/documents/epi')
                .send({ employeeId: 'fake-employee-id' });

            expectUnauthorized(res.status);
        });

        it('should reject NDA document generation without auth', async () => {
            const res = await request(app)
                .post('/api/documents/nda')
                .send({ employeeId: 'fake-employee-id' });

            expectUnauthorized(res.status);
        });

        it('should reject tech device document without auth', async () => {
            const res = await request(app)
                .post('/api/documents/tech-device')
                .send({ employeeId: 'fake-id', deviceName: 'Laptop', serialNumber: 'SN123' });

            expectUnauthorized(res.status);
        });
    });

    describe('Payroll Import', () => {
        it('should reject payroll upload without auth', async () => {
            const res = await request(app)
                .post('/api/payroll/upload');

            expectUnauthorized(res.status);
        });

        it('should reject payroll batch listing without auth', async () => {
            const res = await request(app)
                .get('/api/payroll/batches');

            expectUnauthorized(res.status);
        });

        it('should reject payroll batch apply-mapping without auth', async () => {
            const res = await request(app)
                .post('/api/payroll/batches/fake-batch-id/apply-mapping')
                .send({ mappingRules: [] });

            expectUnauthorized(res.status);
        });
    });

    describe('Expense Management', () => {
        it('should reject expense listing without auth', async () => {
            const res = await request(app)
                .get('/api/expenses');

            expectUnauthorized(res.status);
        });

        it('should reject expense upload without auth', async () => {
            const res = await request(app)
                .post('/api/expenses/upload');

            expectUnauthorized(res.status);
        });

        it('should reject OCR processing without auth', async () => {
            const res = await request(app)
                .post('/api/expenses/ocr');

            expectUnauthorized(res.status);
        });
    });

    describe('Overtime Import', () => {
        it('should reject overtime import without auth', async () => {
            const res = await request(app)
                .post('/api/overtime/import');

            expectUnauthorized(res.status);
        });

        it('should reject overtime listing without auth', async () => {
            const res = await request(app)
                .get('/api/overtime/fake-employee-id');

            expectUnauthorized(res.status);
        });
    });

    describe('Vacation Management', () => {
        it('should reject vacation listing without auth', async () => {
            const res = await request(app)
                .get('/api/vacations');

            expectUnauthorized(res.status);
        });

        it('should reject vacation creation without auth', async () => {
            const res = await request(app)
                .post('/api/vacations')
                .send({ employeeId: 'fake-id', startDate: '2025-01-01', endDate: '2025-01-05' });

            expectUnauthorized(res.status);
        });

        it('should reject vacation approval without auth', async () => {
            const res = await request(app)
                .patch('/api/vacations/fake-id/approve');

            expectUnauthorized(res.status);
        });
    });
});
