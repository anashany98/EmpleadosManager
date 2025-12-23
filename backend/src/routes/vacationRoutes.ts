import { Router } from 'express';
import { VacationController } from '../controllers/VacationController';

const router = Router();

router.get('/', VacationController.getAll);
router.get('/employee/:employeeId', VacationController.getByEmployee);
router.post('/', VacationController.create);
router.delete('/:id', VacationController.delete);

export default router;
