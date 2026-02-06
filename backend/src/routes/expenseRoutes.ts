import { Router } from 'express';
import multer from 'multer';
import { ExpenseController } from '../controllers/ExpenseController';
import { createMulterOptions } from '../config/multer';
import { allowSelfOrRole, restrictTo } from '../middlewares/authMiddleware';

const router = Router();

const upload = multer(createMulterOptions('uploads/expenses/'));

router.get('/', restrictTo('admin'), ExpenseController.getAll);
router.get('/employee/:employeeId', allowSelfOrRole(['admin'], 'employeeId'), ExpenseController.getByEmployee);
router.post('/upload', upload.single('receipt'), ExpenseController.upload);
router.post('/ocr', upload.single('receipt'), ExpenseController.processOCR);
router.put('/:id/status', restrictTo('admin'), ExpenseController.updateStatus);
router.get('/:id/receipt', ExpenseController.getReceipt);
router.delete('/:id', ExpenseController.delete);

export default router;
