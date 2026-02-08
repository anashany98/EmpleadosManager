import express from 'express';
import { OffboardingController } from '../controllers/OffboardingController';
import { protect, restrictTo } from '../middlewares/authMiddleware';

const router = express.Router();

// All offboarding routes are protected and restricted to admin
router.use(protect);
router.use(restrictTo('admin'));

router.get('/:employeeId/prepare', OffboardingController.prepareOffboarding);
router.post('/:employeeId/confirm', OffboardingController.confirmOffboarding);

export default router;
