import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ExpenseController } from '../controllers/ExpenseController';

// Asegurar que existe la carpeta de uploads para gastos
const uploadDir = path.join(__dirname, '../../../uploads/expenses');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

const router = Router();

router.get('/', ExpenseController.getAll);
router.get('/employee/:employeeId', ExpenseController.getByEmployee);
router.post('/upload', upload.single('receipt'), ExpenseController.upload);
router.post('/ocr', upload.single('receipt'), ExpenseController.processOCR);
router.put('/:id/status', ExpenseController.updateStatus);
router.delete('/:id', ExpenseController.delete);

export default router;
