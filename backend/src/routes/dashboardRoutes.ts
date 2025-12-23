import { Router } from 'express';
import { InsightController } from '../controllers/InsightController';
import { AuditController } from '../controllers/AuditController';

const router = Router();
const insights = new InsightController();

router.get('/insights', insights.getDashboardInsights);
router.get('/absences', insights.getDepartmentAbsences);
router.get('/audit', AuditController.getLogs);
router.get('/:entity/:entityId', AuditController.getLogs);

export default router;
