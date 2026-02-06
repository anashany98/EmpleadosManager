import { Router } from 'express';
import { AnomalyController } from '../controllers/AnomalyController';
import { protect, restrictTo, allowSelfOrRole } from '../middlewares/authMiddleware';

const router = Router();

router.use(protect);

router.get('/', restrictTo('admin', 'manager'), AnomalyController.getAll);
router.get('/employee/:employeeId', allowSelfOrRole(['admin', 'manager'], 'employeeId'), AnomalyController.getByEmployee);
router.put('/:id/status', restrictTo('admin', 'manager'), AnomalyController.updateStatus);

export default router;

