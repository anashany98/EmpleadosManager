
import { Router } from 'express';
import { CardController } from '../controllers/CardController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router = Router();

// Protect all routes
router.use(protect);

// Read access: 'cards:read' or admin
router.get('/', checkPermission('cards', 'read'), CardController.getAll);
router.get('/:id', checkPermission('cards', 'read'), CardController.getById);

// Write access: 'cards:write' or admin
router.post('/', checkPermission('cards', 'write'), CardController.create);
router.put('/:id', checkPermission('cards', 'write'), CardController.update);
router.delete('/:id', checkPermission('cards', 'write'), CardController.delete);

export default router;
