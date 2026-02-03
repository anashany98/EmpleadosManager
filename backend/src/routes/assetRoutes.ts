import { Router } from 'express';
import { AssetController } from '../controllers/AssetController';

const router = Router();

router.get('/', AssetController.getAll);
router.post('/', AssetController.create);
router.put('/:id', AssetController.update);
router.delete('/:id', AssetController.delete);

export default router;
