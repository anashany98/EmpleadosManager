import { Router } from 'express';
import { ConfigController } from '../controllers/ConfigController';
import { protect, restrictTo } from '../middlewares/authMiddleware';

const router = Router();

// Backup routes
router.post('/backup', protect, restrictTo('admin'), ConfigController.createBackup);
router.get('/backups', protect, restrictTo('admin'), ConfigController.getBackups);
router.get('/backup/download', protect, restrictTo('admin'), ConfigController.downloadBackup);

// Generic config routes
router.get('/:key', protect, restrictTo('admin'), ConfigController.getConfig);
router.post('/:key', protect, restrictTo('admin'), ConfigController.saveConfig);

export default router;
