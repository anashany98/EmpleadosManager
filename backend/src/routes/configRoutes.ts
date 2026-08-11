import { Router } from 'express';
import { ConfigController } from '../controllers/ConfigController';
import { SmtpController } from '../controllers/SmtpController';
import { protect, requireGlobalAdmin } from '../middlewares/authMiddleware';

const router = Router();

// Backup routes
router.post('/backup', protect, requireGlobalAdmin, ConfigController.createBackup);
router.get('/backups', protect, requireGlobalAdmin, ConfigController.getBackups);
router.get('/backup/download', protect, requireGlobalAdmin, ConfigController.downloadBackup);

// SMTP explicit routes (typed)
router.get('/smtp', protect, requireGlobalAdmin, SmtpController.getSmtpConfig);
router.post('/smtp', protect, requireGlobalAdmin, SmtpController.saveSmtpConfig);
router.post('/smtp/test', protect, requireGlobalAdmin, SmtpController.testSmtpConfig);

// IMAP connection test (diagnose why inbox emails don't arrive)
router.post('/inbox/test', protect, requireGlobalAdmin, ConfigController.testImap);

// Generic config routes
router.get('/:key', protect, requireGlobalAdmin, ConfigController.getConfig);
router.post('/:key', protect, requireGlobalAdmin, ConfigController.saveConfig);

export default router;
