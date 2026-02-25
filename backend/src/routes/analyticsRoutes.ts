import { Router } from 'express';
import { AnalyticsController } from '../controllers/AnalyticsController';
import { protect, restrictTo } from '../middlewares/authMiddleware';

const router = Router();

// All analytics routes require authentication and admin/hr/manager role
router.use(protect);
router.use(restrictTo('admin', 'hr', 'manager'));

// KPIs
router.get('/kpis', AnalyticsController.getKPIs);

// Trends
router.get('/trends/headcount', AnalyticsController.getHeadcountTrend);
router.get('/trends/overtime', AnalyticsController.getOvertimeTrend);

// Breakdowns
router.get('/departments', AnalyticsController.getDepartmentBreakdown);
router.get('/tenure', AnalyticsController.getTenureDistribution);

// Heatmaps
router.get('/heatmap/absences', AnalyticsController.getAbsenceHeatmap);

// Funnel
router.get('/hiring-funnel', AnalyticsController.getHiringFunnel);

// Complete summary
router.get('/summary', AnalyticsController.getSummary);

export default router;
