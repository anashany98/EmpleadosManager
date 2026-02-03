import { Router } from 'express';
import multer from 'multer';
import { ExpenseController } from '../controllers/ExpenseController';
import { createMulterOptions } from '../config/multer';

const router = Router();

const upload = multer(createMulterOptions('uploads/expenses/'));

router.get('/', ExpenseController.getAll);
router.get('/employee/:employeeId', ExpenseController.getByEmployee);
router.post('/upload', upload.single('receipt'), ExpenseController.upload);
router.post('/ocr', upload.single('receipt'), ExpenseController.processOCR);
router.put('/:id/status', ExpenseController.updateStatus);
router.delete('/:id', ExpenseController.delete);

export default router;
