import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

// Protect stream with auth middleware so we know WHO connects
router.get('/stream', protect, NotificationController.stream);

export default router;
