
import { Router } from 'express';
import { alertController } from '../controllers/AlertController';

const router = Router();

router.get('/', (req, res) => alertController.getAlerts(req, res));
router.put('/:id/read', (req, res) => alertController.markAsRead(req, res));
router.put('/:id/dismiss', (req, res) => alertController.dismiss(req, res));

export default router;
