import { Router } from 'express';
import multer from 'multer';
import { PayrollController } from '../controllers/PayrollController';
import { createMulterOptions } from '../config/multer';

const router = Router();

const upload = multer(createMulterOptions('uploads/payroll/', ['.xlsx', '.xls', '.csv']));

router.post('/upload', upload.single('file'), PayrollController.upload);
router.post('/:id/map', PayrollController.applyMapping);
router.get('/:id/rows', PayrollController.getRows);

export default router;
