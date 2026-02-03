import { Router } from 'express';
import { DocumentTemplateController } from '../controllers/DocumentTemplateController';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

router.use(protect);

router.get('/list', DocumentTemplateController.listTemplates);
router.post('/generate', DocumentTemplateController.generate);

export default router;
