import { Router } from 'express';
import { ChecklistController } from '../controllers/ChecklistController';
import { checkPermission } from '../middlewares/authMiddleware';

const router = Router();

router.get('/employee/:employeeId', checkPermission('employees', 'read'), ChecklistController.getByEmployee);
router.post('/', checkPermission('employees', 'write'), ChecklistController.createTask);
router.put('/:id/toggle', checkPermission('employees', 'write'), ChecklistController.toggleTask);
router.delete('/:id', checkPermission('employees', 'write'), ChecklistController.deleteTask);

export default router;
