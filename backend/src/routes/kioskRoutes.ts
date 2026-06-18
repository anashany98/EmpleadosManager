import { Router } from 'express';
import { KioskController } from '../controllers/KioskController';
import { protect, restrictTo } from '../middlewares/authMiddleware';
import { validateResource } from '../middlewares/validateResource';
import { kioskAuthSchema, kioskClockSchema } from '../schemas/kioskSchemas';
import { kioskClockLimiter, requireKioskSecretIfConfigured } from '../middlewares/kioskSecurityMiddleware';

const router = Router();

router.post('/auth', validateResource(kioskAuthSchema), requireKioskSecretIfConfigured, KioskController.authenticateKiosk);
router.post('/clock', kioskClockLimiter, requireKioskSecretIfConfigured, validateResource(kioskClockSchema), KioskController.clockIn);

// Protected routes (for Admin dashboard)
router.get('/activity', protect, restrictTo('admin', 'hr'), KioskController.getKioskActivity);

export default router;
