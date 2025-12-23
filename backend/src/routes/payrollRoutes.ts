import { Router } from 'express';
import multer from 'multer';
import { PayrollController } from '../controllers/PayrollController';
import fs from 'fs';

const router = Router();

// Configurar Multer
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + '.xlsx');
    }
});

const upload = multer({ storage: storage });

router.post('/upload', upload.single('file'), PayrollController.upload);
router.post('/:id/map', PayrollController.applyMapping);
router.get('/:id/rows', PayrollController.getRows);

export default router;
