import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { PasswordController } from '../controllers/PasswordController';
import { SessionController } from '../controllers/SessionController';
import { protect, restrictTo } from '../middlewares/authMiddleware';
import rateLimit from 'express-rate-limit';
import { validateResource } from '../middlewares/validateResource';
import { loginSchema, passwordResetRequestSchema, passwordResetSchema, generateAccessSchema } from '../schemas/authSchemas';
import { checkAccountLockout } from '../middlewares/accountLockout';
import { isAuthThrottlingEnabled } from '../utils/authThrottling';

const router = Router();
const shouldSkipAuthThrottling = () => !isAuthThrottlingEnabled();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // Máximo 5 intentos por ventana
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // No contar logins exitosos
    skip: shouldSkipAuthThrottling,
    message: {
        status: 429,
        message: 'Demasiados intentos de login. Por seguridad, intenta de nuevo en 15 minutos.'
    }
});

const loginGlobalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 30, // Límite general más alto para reintentos legítimos
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipAuthThrottling,
    message: {
        status: 429,
        message: 'Demasiadas solicitudes. Por favor, espera un momento.'
    }
});

const refreshLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 20, // Stricter limit for refresh token rotation
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipAuthThrottling,
    message: {
        status: 429,
        message: 'Demasiadas solicitudes de renovación. Por favor, espera un momento.'
    }
});

const passwordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // Reduced from 10 to 5 - password reset is sensitive
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipAuthThrottling,
    message: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.'
});

// Login: IP-based rate limit → account lockout check → schema validation → login handler
router.post('/login', loginGlobalLimiter, loginLimiter, checkAccountLockout, validateResource(loginSchema), AuthController.login);
router.post('/refresh', refreshLimiter, AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post('/request-password-reset', passwordLimiter, validateResource(passwordResetRequestSchema), PasswordController.requestReset);
router.post('/reset-password', passwordLimiter, validateResource(passwordResetSchema), PasswordController.reset);
router.post('/generate-access', protect, restrictTo('admin'), validateResource(generateAccessSchema), PasswordController.generateAccess);
router.get('/me', protect, SessionController.getMe);

export default router;
