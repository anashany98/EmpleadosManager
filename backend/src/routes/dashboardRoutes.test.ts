import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../controllers/InsightController', () => {
    class MockInsightController {
        getDashboardInsights(_req: express.Request, res: express.Response) {
            return res.status(200).json({ ok: 'insights' });
        }

        getDepartmentAbsences(_req: express.Request, res: express.Response) {
            return res.status(200).json({ ok: 'absences' });
        }

        getUpcomingBirthdays(_req: express.Request, res: express.Response) {
            return res.status(200).json({ ok: 'birthdays' });
        }

        getUpcomingCelebrations(_req: express.Request, res: express.Response) {
            return res.status(200).json({ ok: 'celebrations' });
        }

        getTurnoverRate(_req: express.Request, res: express.Response) {
            return res.status(200).json({ ok: 'turnover' });
        }

        getAbsenteeismRate(_req: express.Request, res: express.Response) {
            return res.status(200).json({ ok: 'absenteeism' });
        }

        getCostByDepartment(_req: express.Request, res: express.Response) {
            return res.status(200).json({ ok: 'costs' });
        }
    }

    return {
        InsightController: MockInsightController
    };
});

vi.mock('../controllers/AuditController', () => ({
    AuditController: {
        getRecentActivity: (_req: express.Request, res: express.Response) => res.status(200).json({ ok: 'activity' }),
        getLogs: (_req: express.Request, res: express.Response) => res.status(200).json({ ok: 'logs' })
    }
}));

import dashboardRoutes from './dashboardRoutes';

const createApp = (user: Record<string, unknown>) => {
    const app = express();
    app.use((req, _res, next) => {
        (req as express.Request & { user?: Record<string, unknown> }).user = user;
        next();
    });
    app.use('/api/dashboard', dashboardRoutes);
    return app;
};

describe('dashboardRoutes', () => {
    it('blocks employees from accessing the admin dashboard endpoints', async () => {
        const app = createApp({
            id: 'employee-1',
            email: 'employee@test.com',
            role: 'employee',
            companyId: 'company-1',
            employeeId: 'emp-1'
        });

        const res = await request(app).get('/api/dashboard/insights');

        expect(res.status).toBe(403);
    });

    it('allows company staff to access dashboard insights and recent activity', async () => {
        const app = createApp({
            id: 'manager-1',
            email: 'manager@test.com',
            role: 'manager',
            companyId: 'company-1'
        });

        const insights = await request(app).get('/api/dashboard/insights');
        const activity = await request(app).get('/api/dashboard/audit');

        expect(insights.status).toBe(200);
        expect(activity.status).toBe(200);
    });

    it('keeps entity-level audit logs reserved for global admins', async () => {
        const staffApp = createApp({
            id: 'manager-1',
            email: 'manager@test.com',
            role: 'manager',
            companyId: 'company-1'
        });
        const adminApp = createApp({
            id: 'admin-1',
            email: 'admin@test.com',
            role: 'admin'
        });

        const staffRes = await request(staffApp).get('/api/dashboard/employee/123');
        const adminRes = await request(adminApp).get('/api/dashboard/employee/123');

        expect(staffRes.status).toBe(403);
        expect(adminRes.status).toBe(200);
    });
});
