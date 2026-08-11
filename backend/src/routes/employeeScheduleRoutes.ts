import { Router } from 'express';
import { EmployeeScheduleController } from '../controllers/EmployeeScheduleController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(protect);

/**
 * Módulo "Horario" — sustituye el Excel de horario individual.
 * Permiso: `employees` (lectura y escritura son la misma operación; es
 *  un módulo pequeño, no necesita `write` separado).
 */
router.get('/:id/schedule', checkPermission('employees', 'read'), EmployeeScheduleController.getMonth);
router.put('/:id/schedule', checkPermission('employees', 'write'), EmployeeScheduleController.upsertDay);
router.delete('/:id/schedule/:date', checkPermission('employees', 'write'), EmployeeScheduleController.deleteDay);

export default router;
