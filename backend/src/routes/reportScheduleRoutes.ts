import { Router } from 'express';
import { checkPermission } from '../middlewares/authMiddleware';
import { reportScheduler } from '../services/ReportScheduler';

const router = Router();

router.use(checkPermission('reports', 'read'));

router.get('/schedules', async (req, res) => {
  try {
    const companyId = (req as any).user?.companyId;
    const schedules = await reportScheduler.getSchedules(companyId);
    res.json(schedules);
  } catch {
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

router.post('/schedules', checkPermission('reports', 'write'), async (req, res) => {
  try {
    const schedule = await reportScheduler.createSchedule(req.body);
    res.json(schedule);
  } catch {
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

router.patch('/schedules/:id/toggle', checkPermission('reports', 'write'), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const schedule = await reportScheduler.toggleSchedule(id, isActive);
    res.json(schedule);
  } catch {
    res.status(500).json({ error: 'Failed to toggle schedule' });
  }
});

router.post('/schedules/:id/run', checkPermission('reports', 'write'), async (req, res) => {
  try {
    const result = await reportScheduler.generateReport(req.params.id);
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to run report' });
  }
});

export default router;