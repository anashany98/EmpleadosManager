import { Router } from 'express';
import { projectController } from '../controllers/ProjectController';
import { checkPermission, requireGlobalAdmin } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', checkPermission('projects', 'read'), requireGlobalAdmin, projectController.getAll);
router.post('/', checkPermission('projects', 'write'), requireGlobalAdmin, projectController.create);
router.delete('/:id', checkPermission('projects', 'write'), requireGlobalAdmin, projectController.delete);

export default router;
