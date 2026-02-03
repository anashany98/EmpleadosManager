import { Router } from 'express';
import { PermissionProfileController } from '../controllers/PermissionProfileController';
import { protect, restrictTo } from '../middlewares/authMiddleware';

const router = Router();

// Only admins can manage permission profiles
router.use(protect);
router.use(restrictTo('admin'));

router.get('/', PermissionProfileController.list);
router.post('/', PermissionProfileController.create);
router.put('/:id', PermissionProfileController.update);
router.delete('/:id', PermissionProfileController.delete);

export default router;
