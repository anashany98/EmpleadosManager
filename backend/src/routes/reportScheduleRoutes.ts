import { Router, type Request, type Response, type NextFunction } from 'express';
import { checkPermission } from '../middlewares/authMiddleware';
import { reportScheduler } from '../services/ReportScheduler';
import { AuthenticatedRequest } from '../types/express';

const router = Router();

router.use(checkPermission('reports', 'read'));

router.get('/schedules', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as AuthenticatedRequest).user;
        const schedules = await reportScheduler.getSchedules(user);
        res.json(schedules);
    } catch (error) {
        next(error);
    }
});

router.post('/schedules', checkPermission('reports', 'write'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as AuthenticatedRequest).user;
        const schedule = await reportScheduler.createSchedule(req.body, user);
        res.status(201).json(schedule);
    } catch (error) {
        const message = (error as Error)?.message || 'Failed to create schedule';
        const status = /destinatarios|inválid/i.test(message) ? 400 : 500;
        res.status(status).json({ error: message });
    }
});

router.patch('/schedules/:id/toggle', checkPermission('reports', 'write'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as AuthenticatedRequest).user;
        const { id } = req.params;
        const { isActive } = req.body;
        const result = await reportScheduler.toggleSchedule(id, !!isActive, user);
        if (!result.success) {
            // 404 uniforme para no enumerar schedules de otros tenants
            return res.status(404).json({ error: result.error });
        }
        res.json({ schedule: (result as any).schedule });
    } catch (error) {
        next(error);
    }
});

router.post('/schedules/:id/run', checkPermission('reports', 'write'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as AuthenticatedRequest).user;
        const result = await reportScheduler.generateReport(req.params.id, user);
        if (!result.success) {
            const status = /not found|forbidden/i.test(result.error || '') ? 404 : 500;
            return res.status(status).json({ error: result.error });
        }
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
