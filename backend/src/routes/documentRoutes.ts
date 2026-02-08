import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { DocumentController } from '../controllers/DocumentController';
import { createMulterOptions } from '../config/multer';
import { allowSelfOrRole } from '../middlewares/authMiddleware';

const router = Router();

const upload = multer(createMulterOptions('uploads/documents/'));

import { DocumentTemplateController } from '../controllers/DocumentTemplateController';
// ...
router.post('/generate-uniform', DocumentTemplateController.generateUniform);
router.post('/generate-epi', DocumentTemplateController.generateEPI);
router.post('/generate-tech', DocumentTemplateController.generateTech);
router.post('/generate-145', DocumentTemplateController.generate145);
router.post('/generate-nda', DocumentTemplateController.generateNDA);
router.post('/generate-rgpd', DocumentTemplateController.generateRGPD);

router.post('/upload', upload.single('file'), DocumentController.upload);
router.post('/ocr', upload.single('file'), DocumentController.processOCR);
router.get('/employee/:employeeId', allowSelfOrRole(['admin'], 'employeeId'), DocumentController.getByEmployee);
router.get('/:id/download', DocumentController.download);
router.delete('/:id', DocumentController.delete);

export default router;
