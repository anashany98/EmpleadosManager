import { Router } from 'express';
import { InboxController } from '../controllers/InboxController';
import { authorize, checkPermission } from '../middlewares/authMiddleware';
import { prisma } from '../lib/prisma';
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
});

const resolveAssignTarget = async (req: any) => {
    const { employeeId } = req.body;
    if (!employeeId) return null;
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, companyId: true }
    });
    return employee ? { employeeId: employee.id, companyId: employee.companyId } : null;
};

router.post('/upload', checkPermission('employees', 'write'), upload.single('file'), InboxController.upload);
router.get('/pending', checkPermission('employees', 'read'), InboxController.getAllPending);
router.post('/sync', checkPermission('employees', 'read'), InboxController.triggerSync);
router.get('/:id/download', checkPermission('employees', 'read'), InboxController.download);
router.post('/:id/assign', authorize('document.write', resolveAssignTarget), InboxController.assign);
router.delete('/:id', checkPermission('employees', 'write'), InboxController.delete);

export default router;