import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { protect, restrictTo } from '../middlewares/authMiddleware';

const router = Router();

// Only admins can manage users
router.use(protect);
router.use(restrictTo('admin'));

router.get('/', UserController.list);
router.post('/', UserController.create);
router.put('/:id', UserController.update);
router.delete('/:id', UserController.delete);

export default router;
