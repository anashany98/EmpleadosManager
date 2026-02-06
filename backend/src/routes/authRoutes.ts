import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { protect, restrictTo } from '../middlewares/authMiddleware';
import rateLimit from 'express-rate-limit';

const router = Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.'
});

const passwordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.'
});

router.post('/login', loginLimiter, AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post('/request-password-reset', passwordLimiter, AuthController.requestPasswordReset);
router.post('/reset-password', passwordLimiter, AuthController.resetPassword);
router.post('/generate-access', protect, restrictTo('admin'), AuthController.generateAccess);
router.get('/me', protect, AuthController.getMe);

export default router;
