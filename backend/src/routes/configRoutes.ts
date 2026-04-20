import { Router } from 'express';
import { ConfigController } from '../controllers/ConfigController';
import { protect, requireGlobalAdmin } from '../middlewares/authMiddleware';

const router = Router();

// Backup routes
router.post('/backup', protect, requireGlobalAdmin, ConfigController.createBackup);
router.get('/backups', protect, requireGlobalAdmin, ConfigController.getBackups);
router.get('/backup/download', protect, requireGlobalAdmin, ConfigController.downloadBackup);

// Generic config routes
router.get('/:key', protect, requireGlobalAdmin, ConfigController.getConfig);
router.post('/:key', protect, requireGlobalAdmin, ConfigController.saveConfig);

export default router;
