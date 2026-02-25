import { Router } from 'express';
import { EvaluationController } from '../controllers/EvaluationController';
import { ObjectiveController } from '../controllers/ObjectiveController';
import { PDIController } from '../controllers/PDIController';
import { restrictTo, checkPermission } from '../middlewares/authMiddleware';

const router = Router();

// ============================================
// EVALUATION ROUTES
// ============================================

// Evaluations - Admin/HR can create, all authenticated can read (with controller-level checks)
router.post('/evaluations', restrictTo('admin', 'hr'), EvaluationController.create);
router.post('/evaluations/bulk', restrictTo('admin', 'hr'), EvaluationController.createBulk);
router.get('/evaluations', checkPermission('employees', 'read'), EvaluationController.list);
router.get('/evaluations/stats', restrictTo('admin', 'hr'), EvaluationController.getStats);
router.get('/evaluations/:id', checkPermission('employees', 'read'), EvaluationController.getById);
router.put('/evaluations/:id', restrictTo('admin', 'hr'), EvaluationController.update);
router.post('/evaluations/:id/self-evaluate', EvaluationController.submitSelfEvaluation); // Controller validates employee
router.post('/evaluations/:id/manager-evaluate', checkPermission('employees', 'write'), EvaluationController.submitManagerEvaluation);
router.post('/evaluations/:id/acknowledge', EvaluationController.acknowledge); // Controller validates employee

// ============================================
// OBJECTIVE ROUTES
// ============================================

router.post('/objectives', checkPermission('employees', 'write'), ObjectiveController.create);
router.post('/objectives/cascade', restrictTo('admin', 'hr', 'manager'), ObjectiveController.createCascade);
router.get('/objectives', checkPermission('employees', 'read'), ObjectiveController.list);
router.get('/objectives/stats', checkPermission('employees', 'read'), ObjectiveController.getStats);
router.get('/objectives/overdue', checkPermission('employees', 'read'), ObjectiveController.getOverdue);
router.get('/objectives/:id', checkPermission('employees', 'read'), ObjectiveController.getById);
router.put('/objectives/:id', checkPermission('employees', 'write'), ObjectiveController.update);
router.patch('/objectives/:id/progress', checkPermission('employees', 'write'), ObjectiveController.updateProgress);
router.delete('/objectives/:id', restrictTo('admin', 'hr'), ObjectiveController.delete);

// ============================================
// PDI ROUTES
// ============================================

router.post('/pdis', checkPermission('employees', 'write'), PDIController.create);
router.get('/pdis', checkPermission('employees', 'read'), PDIController.list);
router.get('/pdis/stats', checkPermission('employees', 'read'), PDIController.getStats);
router.get('/pdis/active/:employeeId', checkPermission('employees', 'read'), PDIController.getActive);
router.get('/pdis/:id', checkPermission('employees', 'read'), PDIController.getById);
router.put('/pdis/:id', checkPermission('employees', 'write'), PDIController.update);
router.post('/pdis/:id/activate', restrictTo('admin', 'hr'), PDIController.activate);
router.post('/pdis/:id/complete', checkPermission('employees', 'write'), PDIController.complete);
router.post('/pdis/:id/training', checkPermission('employees', 'write'), PDIController.addTraining);
router.patch('/pdis/:id/training', checkPermission('employees', 'write'), PDIController.updateTrainingStatus);

export default router;