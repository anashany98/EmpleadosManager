import { Router } from 'express';
import { TimeEntryController } from '../controllers/TimeEntryController';

const router = Router();

// Rutas para fichajes
router.get('/employee/:employeeId', TimeEntryController.getByEmployee);
router.get('/employee/:employeeId/month/:year/:month', TimeEntryController.getByEmployeeMonth);
router.get('/date/:date', TimeEntryController.getByDate);
router.get('/range', TimeEntryController.getByRange);
router.post('/', TimeEntryController.upsert);
router.put('/:id', TimeEntryController.update);
router.delete('/:id', TimeEntryController.delete);

export default router;
