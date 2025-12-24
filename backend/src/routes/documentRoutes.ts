import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { DocumentController } from '../controllers/DocumentController';

const router = Router();

// Configuración de Multer para almacenamiento local
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/documents/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

router.post('/upload', upload.single('file'), DocumentController.upload);
router.post('/ocr', upload.single('file'), DocumentController.processOCR);
router.get('/employee/:employeeId', DocumentController.getByEmployee);
router.delete('/:id', DocumentController.delete);

export default router;
