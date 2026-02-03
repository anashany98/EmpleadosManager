
import { Router } from 'express';
import { ReportController } from '../controllers/ReportController';

const router = Router();

router.get('/attendance', ReportController.getAttendance);
router.get('/overtime', ReportController.getOvertime);
router.get('/vacations', ReportController.getVacations);
router.get('/costs', ReportController.getCosts);
router.get('/absences-detailed', ReportController.getDetailedAbsences);
router.get('/kpis', ReportController.getKPIs);
router.get('/gender-gap', ReportController.getGenderGap);

export default router;
