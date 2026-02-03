import { Router } from 'express';
import { ChecklistController } from '../controllers/ChecklistController';

const router = Router();

router.get('/employee/:employeeId', ChecklistController.getByEmployee);
router.post('/', ChecklistController.createTask);
router.put('/:id/toggle', ChecklistController.toggleTask);
router.delete('/:id', ChecklistController.deleteTask);

export default router;
