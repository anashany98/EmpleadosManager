import { Router } from 'express';
import { DocumentTemplateController } from '../controllers/DocumentTemplateController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(protect);

router.get('/list', checkPermission('employees', 'read'), DocumentTemplateController.listTemplates);
router.post('/generate', checkPermission('employees', 'write'), DocumentTemplateController.generate);

export default router;
