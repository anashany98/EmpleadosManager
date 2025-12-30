import { Router } from 'express';
import { InsightController } from '../controllers/InsightController';
import { AuditController } from '../controllers/AuditController';

const router = Router();
const insights = new InsightController();

router.get('/insights', insights.getDashboardInsights);
router.get('/absences', insights.getDepartmentAbsences);
router.get('/birthdays', insights.getUpcomingBirthdays);
router.get('/celebrations', insights.getUpcomingCelebrations);
router.get('/analytics/turnover', insights.getTurnoverRate);
router.get('/analytics/absenteeism', insights.getAbsenteeismRate);
router.get('/analytics/costs', insights.getCostByDepartment);
router.get('/audit', AuditController.getRecentActivity);
router.get('/:entity/:entityId', AuditController.getLogs);

export default router;
