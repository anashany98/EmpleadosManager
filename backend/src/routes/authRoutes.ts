import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.get('/me', protect, AuthController.getMe);

export default router;
