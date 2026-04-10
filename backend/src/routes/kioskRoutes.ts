import { Router } from 'express';
import { KioskController } from '../controllers/KioskController';
import { protect, restrictTo } from '../middlewares/authMiddleware';
import { validateResource } from '../middlewares/validateResource';
import { kioskAuthSchema, kioskClockSchema, kioskEnrollSchema, kioskIdentifySchema } from '../schemas/kioskSchemas';
import { kioskClockLimiter, kioskIdentifyLimiter, requireKioskSecretIfConfigured } from '../middlewares/kioskSecurityMiddleware';

const router = Router();

router.post('/auth', validateResource(kioskAuthSchema), requireKioskSecretIfConfigured, KioskController.authenticateKiosk);
router.post('/identify', kioskIdentifyLimiter, requireKioskSecretIfConfigured, validateResource(kioskIdentifySchema), KioskController.identifyEmployee);
router.post('/clock', kioskClockLimiter, requireKioskSecretIfConfigured, validateResource(kioskClockSchema), KioskController.clockIn);

// Protected routes (for Admin dashboard to enroll/manage)
router.get('/activity', protect, restrictTo('admin', 'hr'), KioskController.getKioskActivity);
router.post('/enroll', protect, restrictTo('admin', 'hr'), validateResource(kioskEnrollSchema), KioskController.enrollFace);

export default router;
