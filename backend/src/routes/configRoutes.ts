import { Router } from 'express';
import { ConfigController } from '../controllers/ConfigController';
import { protect, restrictTo } from '../middlewares/authMiddleware';

const router = Router();

// Only admins can manage global configuration
router.get('/:key', protect, restrictTo('admin'), ConfigController.getConfig);
router.post('/:key', protect, restrictTo('admin'), ConfigController.saveConfig);

export default router;
