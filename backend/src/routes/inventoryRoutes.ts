import { Router } from 'express';
import { InventoryController } from '../controllers/InventoryController';
import { protect, checkPermission, requireGlobalAdmin } from '../middlewares/authMiddleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

router.use(protect); // All inventory routes are protected

const imageStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const dir = path.join(process.cwd(), 'uploads', 'inventory');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const imageUpload = multer({
    storage: imageStorage,
    fileFilter: (_req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    },
    limits: { fileSize: 5 * 1024 * 1024 }
});

const csvStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const dir = path.join(process.cwd(), 'uploads', 'inventory');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        cb(null, `import-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const csvUpload = multer({
    storage: csvStorage,
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, ['.csv', '.txt'].includes(ext));
    },
    limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/', checkPermission('assets', 'read'), requireGlobalAdmin, InventoryController.getAll);
router.post('/', checkPermission('assets', 'write'), requireGlobalAdmin, InventoryController.create);
router.put('/:id', checkPermission('assets', 'write'), requireGlobalAdmin, InventoryController.update);
router.delete('/:id', checkPermission('assets', 'write'), requireGlobalAdmin, InventoryController.delete);
router.post('/:id/stock', checkPermission('assets', 'write'), requireGlobalAdmin, InventoryController.addStock);
router.post('/:id/withdraw', checkPermission('assets', 'write'), requireGlobalAdmin, InventoryController.withdraw);
router.post('/:id/distribute', checkPermission('assets', 'write'), requireGlobalAdmin, InventoryController.distribute);
router.get('/:id/movements', checkPermission('assets', 'read'), requireGlobalAdmin, InventoryController.getMovements);
router.post('/:id/generate-receipt', checkPermission('assets', 'write'), requireGlobalAdmin, InventoryController.generateReceipt);
router.post('/:id/image', checkPermission('assets', 'write'), requireGlobalAdmin, imageUpload.single('image'), InventoryController.uploadImage);
router.post('/import', checkPermission('assets', 'write'), requireGlobalAdmin, csvUpload.single('file'), InventoryController.importCsv);

export const inventoryRoutes = router;
