import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { DocumentController } from '../controllers/DocumentController';
import { createMulterOptions } from '../config/multer';
import { allowSelfOrRole } from '../middlewares/authMiddleware';

const router = Router();

const upload = multer(createMulterOptions('uploads/documents/'));

router.post('/upload', upload.single('file'), DocumentController.upload);
router.post('/ocr', upload.single('file'), DocumentController.processOCR);
router.get('/employee/:employeeId', allowSelfOrRole(['admin'], 'employeeId'), DocumentController.getByEmployee);
router.get('/:id/download', DocumentController.download);
router.delete('/:id', DocumentController.delete);

export default router;
