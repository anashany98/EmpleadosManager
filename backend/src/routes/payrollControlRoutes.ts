import { Router } from 'express';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { PayrollControlController } from '../controllers/PayrollControlController';
import { checkPermission } from '../middlewares/authMiddleware';
import { createMulterOptions } from '../config/multer';
import { validateResource } from '../middlewares/validateResource';
import { timeSheetImportSchema } from '../schemas/payrollControlSchemas';
import { hasModuleAccess } from '../../../shared/authz';
import { AppError } from '../utils/AppError';
import type { AuthenticatedRequest } from '../types/express';

const router = Router();

// El parte de horas por obra se usa desde el control horario del empleado
// (módulo employees) y desde el control de gestoría (módulo payroll), así que
// se permite con cualquiera de los dos permisos de lectura.
const canReadControlHorarioOrPayroll: RequestHandler = (req, res, next) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new AppError('No estás autenticado.', 401));
    if (hasModuleAccess(user, 'employees', 'read') || hasModuleAccess(user, 'payroll', 'read')) return next();
    return next(new AppError('No tienes acceso al control horario.', 403));
};
const timeSheetUpload = multer(createMulterOptions('uploads/payroll-control/', ['.xlsx'], ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']));

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
router.post('/employee/:employeeId/init-period', checkPermission('employees', 'write'), PayrollControlController.initEmployeePeriod);
router.put('/employee/:employeeId', checkPermission('employees', 'write'), PayrollControlController.updateEmployeeRecord);
router.put('/employee/:employeeId/daily', checkPermission('employees', 'write'), PayrollControlController.updateEmployeeDailyEntries);
router.post('/employee/:employeeId/daily/import-preview', checkPermission('employees', 'write'), timeSheetUpload.single('file'), validateResource(timeSheetImportSchema), PayrollControlController.previewEmployeeTimeSheetImport);
router.post('/employee/:employeeId/daily/import', checkPermission('employees', 'write'), timeSheetUpload.single('file'), validateResource(timeSheetImportSchema), PayrollControlController.importEmployeeTimeSheet);

// Parte mensual de horas imputadas a obras (Excel)
router.get('/obra-hours/export', canReadControlHorarioOrPayroll, PayrollControlController.exportObraHours);

// Exportación a Gestoría
router.post('/export/gestoria/preview', checkPermission('payroll', 'write'), PayrollControlController.previewGestoria);
router.post('/export/gestoria', checkPermission('payroll', 'write'), PayrollControlController.exportToGestoria);
router.get('/export/gestoria/:exportId/download', checkPermission('payroll', 'read'), PayrollControlController.downloadExport);

export default router;
