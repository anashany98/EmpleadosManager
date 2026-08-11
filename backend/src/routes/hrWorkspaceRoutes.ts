import { Router } from 'express';
import { checkPermission } from '../middlewares/authMiddleware';
import { HrWorkspaceController } from '../controllers/HrWorkspaceController';

const router = Router();

router.get('/overview', checkPermission('employees', 'read'), HrWorkspaceController.overview);
router.post('/sync', checkPermission('employees', 'write'), HrWorkspaceController.sync);
router.post('/tasks', checkPermission('employees', 'write'), HrWorkspaceController.createTask);
router.patch('/tasks/:id', checkPermission('employees', 'write'), HrWorkspaceController.updateTask);

router.get('/alert-rules', checkPermission('notifications', 'read'), HrWorkspaceController.alertRules);
router.get('/alert-email-status', checkPermission('notifications', 'read'), HrWorkspaceController.alertEmailStatus);
router.patch('/alert-rules/:id', checkPermission('employees', 'write'), HrWorkspaceController.updateAlertRule);

router.get('/monthly-close', checkPermission('reports', 'read'), HrWorkspaceController.monthlyClose);
router.patch('/monthly-close/:id/items/:itemKey', checkPermission('employees', 'write'), HrWorkspaceController.updateMonthlyCloseItem);
router.patch('/monthly-close/:id/status', checkPermission('employees', 'write'), HrWorkspaceController.setMonthlyCloseStatus);

router.get('/employees/:employeeId/smart-record', checkPermission('employees', 'read'), HrWorkspaceController.smartRecord);
router.get('/search', checkPermission('employees', 'read'), HrWorkspaceController.search);

export default router;
