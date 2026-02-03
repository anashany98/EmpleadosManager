import { Router } from 'express';
import { employeeProjectWorkController } from '../controllers/EmployeeProjectWorkController';

const router = Router();

router.get('/employee/:employeeId', employeeProjectWorkController.getByEmployee);
router.post('/', employeeProjectWorkController.create);
router.delete('/:id', employeeProjectWorkController.delete);

export default router;
