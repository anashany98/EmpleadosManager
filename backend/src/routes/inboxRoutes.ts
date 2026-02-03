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

const upload = multer({ dest: tempDir }); // Temp storage, controller will move it

router.post('/upload', protect, checkPermission('employees', 'write'), upload.single('file'), InboxController.upload);
router.get('/pending', protect, checkPermission('employees', 'read'), InboxController.getAllPending);
router.post('/:id/assign', protect, checkPermission('employees', 'write'), InboxController.assign);
router.delete('/:id', protect, checkPermission('employees', 'write'), InboxController.delete);

export default router;
