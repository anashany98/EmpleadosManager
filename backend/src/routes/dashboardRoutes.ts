import { Router } from 'express';
import { InsightController } from '../controllers/InsightController';
import { AuditController } from '../controllers/AuditController';
import { checkPermission, requireGlobalAdmin, restrictTo } from '../middlewares/authMiddleware';
import { prisma } from '../lib/prisma';

const router = Router();
const insights = new InsightController();

router.use(restrictTo('admin', 'hr', 'manager'));

router.get('/insights', checkPermission('dashboard', 'read'), insights.getDashboardInsights);
router.get('/absences', checkPermission('dashboard', 'read'), insights.getDepartmentAbsences);
router.get('/birthdays', checkPermission('dashboard', 'read'), insights.getUpcomingBirthdays);
router.get('/celebrations', checkPermission('dashboard', 'read'), insights.getUpcomingCelebrations);
router.get('/analytics/turnover', checkPermission('analytics', 'read'), insights.getTurnoverRate);
router.get('/analytics/absenteeism', checkPermission('analytics', 'read'), insights.getAbsenteeismRate);
router.get('/analytics/costs', checkPermission('analytics', 'read'), insights.getCostByDepartment);
router.get('/audit', checkPermission('dashboard', 'read'), AuditController.getRecentActivity);
router.get('/:entity/:entityId', requireGlobalAdmin, AuditController.getLogs);

router.get('/config', checkPermission('dashboard', 'read'), async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const config = await prisma.dashboardConfig.findUnique({ where: { userId } });
    if (config) {
      res.json({ widgets: JSON.parse(config.widgets), layout: JSON.parse(config.layout), tab: config.tab });
    } else {
      res.json({ widgets: [], layout: '[]', tab: 'overview' });
    }
  } catch {
    res.status(500).json({ error: 'Failed to fetch dashboard config' });
  }
});

router.post('/config', checkPermission('dashboard', 'write'), async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { widgets, layout, tab } = req.body;
    const config = await prisma.dashboardConfig.upsert({
      where: { userId },
      create: {
        userId,
        widgets: JSON.stringify(widgets || []),
        layout: JSON.stringify(layout || []),
        tab: tab || 'overview'
      },
      update: {
        widgets: JSON.stringify(widgets || []),
        layout: JSON.stringify(layout || []),
        tab: tab || 'overview'
      }
    });
    res.json(config);
  } catch {
    res.status(500).json({ error: 'Failed to save dashboard config' });
  }
});

export default router;
