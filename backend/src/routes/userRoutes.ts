import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { protect, requireGlobalAdmin } from '../middlewares/authMiddleware';

const router = Router();

// Only admins can manage users
router.use(protect);
router.use(requireGlobalAdmin);

router.get('/', UserController.list);
router.post('/', UserController.create);
router.put('/:id', UserController.update);
router.patch('/:id/toggle-active', UserController.toggleActive);
router.delete('/:id', UserController.delete);

export default router;
