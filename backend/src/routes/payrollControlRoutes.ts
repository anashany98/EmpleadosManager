import { Router } from 'express';
import { PayrollControlController } from '../controllers/PayrollControlController';
import { checkPermission } from '../middlewares/authMiddleware';

const router = Router();

// Control General y Administración RRHH
router.get('/concepts', checkPermission('payroll', 'read'), PayrollControlController.listConcepts);
router.post('/concepts', checkPermission('payroll', 'write'), PayrollControlController.createConcept);
router.get('/periods', checkPermission('payroll', 'read'), PayrollControlController.listPeriods);
router.post('/periods', checkPermission('payroll', 'write'), PayrollControlController.createPeriod);
router.get('/periods/:periodId/exports', checkPermission('payroll', 'read'), PayrollControlController.listExports);
router.get('/', checkPermission('payroll', 'read'), PayrollControlController.getPeriod);
router.put('/records/:id', checkPermission('payroll', 'write'), PayrollControlController.updateRecord);
router.post('/records/:id/restore', checkPermission('payroll', 'write'), PayrollControlController.restoreCell);
router.put('/records/:id/concepts', checkPermission('payroll', 'write'), PayrollControlController.updateConceptValue);
router.post('/period/status', checkPermission('payroll', 'write'), PayrollControlController.updatePeriodStatus);

// Integración con Perfil de Empleado (Pestaña Control horario)
router.get('/employee/:employeeId', checkPermission('employees', 'read'), PayrollControlController.getEmployeeRecord);
router.put('/employee/:employeeId', checkPermission('employees', 'write'), PayrollControlController.updateEmployeeRecord);
router.put('/employee/:employeeId/daily', checkPermission('employees', 'write'), PayrollControlController.updateEmployeeDailyEntries);

// Exportación a Gestoría
router.post('/export/gestoria/preview', checkPermission('payroll', 'write'), PayrollControlController.previewGestoria);
router.post('/export/gestoria', checkPermission('payroll', 'write'), PayrollControlController.exportToGestoria);
router.get('/export/gestoria/:exportId/download', checkPermission('payroll', 'read'), PayrollControlController.downloadExport);

export default router;
