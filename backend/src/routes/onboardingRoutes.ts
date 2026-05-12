
import { Router } from 'express';
import { OnboardingController } from '../controllers/OnboardingController';
import { protect, restrictTo, checkPermission, requireGlobalAdmin } from '../middlewares/authMiddleware';

const router = Router();

// Templates (Admin only)
router.get('/templates', protect, checkPermission('onboarding', 'read'), OnboardingController.getTemplates);
router.post('/templates', protect, restrictTo('admin'), OnboardingController.createTemplate);

// Assignments
// Assignments
router.post('/assign', protect, restrictTo('admin'), OnboardingController.assignTemplate);
router.post('/start', protect, requireGlobalAdmin, OnboardingController.startOnboardingProcess);

// Employee Checklists
router.get('/employee/:employeeId', protect, OnboardingController.getEmployeeChecklists);
router.put('/checklist/:id', protect, OnboardingController.updateChecklist);
router.delete('/checklist/:id', protect, restrictTo('admin'), OnboardingController.deleteChecklist);

export default router;
