import { Router } from 'express';
import { KioskController } from '../controllers/KioskController';
import { protect, restrictTo } from '../middlewares/authMiddleware';

const router = Router();

// Public routes (for the Kiosk Device, secured by shared secret or just open if internal)
//Ideally using a specific middleware for Kiosk Secret
router.post('/identify', KioskController.identifyEmployee);
router.post('/clock', KioskController.clockIn);

// Protected routes (for Admin dashboard to enroll/manage)
router.get('/activity', protect, restrictTo('admin', 'hr'), KioskController.getKioskActivity);
router.post('/enroll', protect, restrictTo('admin', 'hr'), KioskController.enrollFace);
router.post('/auth', KioskController.authenticateKiosk);

export default router;
