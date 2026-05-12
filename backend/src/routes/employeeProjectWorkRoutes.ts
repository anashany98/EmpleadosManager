import { Router } from 'express';
import { employeeProjectWorkController } from '../controllers/EmployeeProjectWorkController';
import { checkPermission } from '../middlewares/authMiddleware';

const router = Router();

router.get('/employee/:employeeId', checkPermission('projects', 'read'), employeeProjectWorkController.getByEmployee);
router.post('/', checkPermission('projects', 'write'), employeeProjectWorkController.create);
router.delete('/:id', checkPermission('projects', 'write'), employeeProjectWorkController.delete);

export default router;
