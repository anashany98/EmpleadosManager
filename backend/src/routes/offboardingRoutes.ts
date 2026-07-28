import express from 'express';
import { OffboardingController } from '../controllers/OffboardingController';
import { protect, requireGlobalAdmin } from '../middlewares/authMiddleware';

const router = express.Router();

// All offboarding routes are protected and restricted to admin
router.use(protect);
router.use(requireGlobalAdmin);

router.get('/:employeeId/prepare', OffboardingController.prepareOffboarding);
router.post('/:employeeId/confirm', OffboardingController.confirmOffboarding);
router.post('/:employeeId/reactivate', OffboardingController.reactivate);

export default router;
