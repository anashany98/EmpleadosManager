
import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

router.use(protect);

router.get('/', NotificationController.getMine);
router.put('/:id/read', NotificationController.markRead);
router.put('/read-all', NotificationController.markAllRead);

export default router;
