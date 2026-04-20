
import { Router } from 'express';
import { alertController } from '../controllers/AlertController';
import { checkPermission } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', checkPermission('notifications', 'read'), (req, res) => alertController.getAlerts(req, res));
router.put('/:id/read', checkPermission('notifications', 'read'), (req, res) => alertController.markAsRead(req, res));
router.put('/:id/dismiss', checkPermission('notifications', 'read'), (req, res) => alertController.dismiss(req, res));
router.put('/read-all', checkPermission('notifications', 'read'), (req, res) => alertController.markAllRead(req, res));
router.put('/dismiss-all', checkPermission('notifications', 'read'), (req, res) => alertController.dismissAll(req, res));

export default router;
