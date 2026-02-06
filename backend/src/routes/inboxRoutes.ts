import { Router } from 'express';
import { InboxController } from '../controllers/InboxController';
import { protect, checkPermission } from '../middlewares/authMiddleware';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = Router();
const tempDir = path.join(process.cwd(), 'data/inbox_temp/');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
const upload = multer({
    dest: tempDir,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de archivo no permitido. Permitidos: ${allowedExtensions.join(', ')}`));
        }
    }
}); // Temp storage, controller will move it

router.post('/upload', protect, checkPermission('employees', 'write'), upload.single('file'), InboxController.upload);
router.get('/pending', protect, checkPermission('employees', 'read'), InboxController.getAllPending);
router.get('/:id/download', protect, checkPermission('employees', 'read'), InboxController.download);
router.post('/:id/assign', protect, checkPermission('employees', 'write'), InboxController.assign);
router.delete('/:id', protect, checkPermission('employees', 'write'), InboxController.delete);

export default router;
