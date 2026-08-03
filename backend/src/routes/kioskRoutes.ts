import { Router } from 'express';
import { KioskController } from '../controllers/KioskController';
import { protect, restrictTo } from '../middlewares/authMiddleware';
import { validateResource } from '../middlewares/validateResource';
import { kioskAuthSchema, kioskClockSchema } from '../schemas/kioskSchemas';
import { kioskClockLimiter, requireKioskSecretIfConfigured } from '../middlewares/kioskSecurityMiddleware';

const router = Router();

// Kiosk desactivado (decisión funcional 2026-07-20, confirmada 2026-08-03):
// la UI ya no expone el módulo, pero los endpoints seguían activos y exentos
// de CSRF. Por defecto TODOS los endpoints del kiosk devuelven 503.
// Para reactivarlo: KIOSK_ENABLED=true en el entorno (y revisar antes
// el diseño de PIN: actualmente el PIN del kiosk ES la contraseña del
// usuario, ver INFORME_REVISION_2026-08-03 BAJ-2).
const kioskEnabled = process.env.KIOSK_ENABLED === 'true';

if (!kioskEnabled) {
    router.all('*', (_req, res) => {
        res.status(503).json({
            success: false,
            message: 'El módulo de kiosco está desactivado'
        });
    });
} else {
    router.post('/auth', validateResource(kioskAuthSchema), requireKioskSecretIfConfigured, KioskController.authenticateKiosk);
    router.post('/clock', kioskClockLimiter, requireKioskSecretIfConfigured, validateResource(kioskClockSchema), KioskController.clockIn);

    // Protected routes (for Admin dashboard)
    router.get('/activity', protect, restrictTo('admin', 'hr'), KioskController.getKioskActivity);
}

export default router;
