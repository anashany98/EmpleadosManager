import { Router } from 'express';
import { employeeDashboardController } from '../controllers/EmployeeDashboardController';

const router = Router();

router.get('/employees', (req, res) => employeeDashboardController.getEmployeeMetrics(req, res));

export default router;
