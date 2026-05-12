import { Router } from 'express';
import { AssetController } from '../controllers/AssetController';
import { checkPermission } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', checkPermission('assets', 'read'), AssetController.getAll);
router.post('/', checkPermission('assets', 'write'), AssetController.create);
router.put('/:id', checkPermission('assets', 'write'), AssetController.update);
router.delete('/:id', checkPermission('assets', 'write'), AssetController.delete);
router.post('/:id/return', checkPermission('assets', 'write'), AssetController.returnAsset);

export default router;
