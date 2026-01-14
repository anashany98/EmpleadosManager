import { Router } from 'express';
import { VacationController } from '../controllers/VacationController';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(protect);

router.get('/', VacationController.getAll);
router.get('/my-vacations', VacationController.getMyVacations);
router.get('/manage', VacationController.getManageableVacations);
router.get('/employee/:employeeId', VacationController.getByEmployee);
router.post('/', VacationController.create);
router.delete('/:id', VacationController.delete);
router.put('/:id/status', VacationController.updateStatus);

export default router;
