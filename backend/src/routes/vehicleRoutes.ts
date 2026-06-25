import { Router } from 'express';
import { VehicleController } from '../controllers/VehicleController';
import { protect, checkPermission } from '../middlewares/authMiddleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { validateDiskUploadMiddleware } from '../config/multer';

const router = Router();

router.use(protect);

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads', 'vehicle-documents');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const docUpload = multer({
    storage,
    fileFilter: (_req, file, cb) => {
        const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo no permitido: ${ext}`));
        }
    },
    limits: { fileSize: 20 * 1024 * 1024 }
});

// Read access: 'fleet:read' or admin
router.get('/', checkPermission('fleet', 'read'), VehicleController.getAll);
router.get('/:id', checkPermission('fleet', 'read'), VehicleController.getById);

// Write access: 'fleet:write' or admin
router.post('/', checkPermission('fleet', 'write'), VehicleController.create);
router.put('/:id', checkPermission('fleet', 'write'), VehicleController.update);
router.get('/:id/logs', checkPermission('fleet', 'read'), VehicleController.getLogs);
router.post('/:id/logs', checkPermission('fleet', 'write'), VehicleController.createLog);
router.delete('/:id/logs/:logId', checkPermission('fleet', 'write'), VehicleController.deleteLog);
router.post('/:id/documents', checkPermission('fleet', 'write'), docUpload.single('document'), validateDiskUploadMiddleware('document'), VehicleController.uploadDocument);
router.get('/:id/documents/:docId/download', checkPermission('fleet', 'read'), VehicleController.downloadDocument);
router.delete('/:id/documents/:docId', checkPermission('fleet', 'write'), VehicleController.deleteDocument);
router.delete('/:id', checkPermission('fleet', 'write'), VehicleController.delete);

export default router;
