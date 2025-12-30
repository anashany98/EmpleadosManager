import { Router } from 'express';
import { projectController } from '../controllers/ProjectController';

const router = Router();

router.get('/', projectController.getAll);
router.post('/', projectController.create);
router.delete('/:id', projectController.delete);

export default router;
