import { Router } from 'express';
import { InsightController } from '../controllers/InsightController';
import { AuditController } from '../controllers/AuditController';
import { checkPermission, requireGlobalAdmin, restrictTo } from '../middlewares/authMiddleware';

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

export default router;
