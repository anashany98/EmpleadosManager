import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { DocumentController } from '../controllers/DocumentController';
import { createMulterOptions } from '../config/multer';
import { authorize } from '../middlewares/authMiddleware';
import { prisma } from '../lib/prisma';

const router = Router();

const upload = multer(createMulterOptions('uploads/documents/'));

import { DocumentTemplateController } from '../controllers/DocumentTemplateController';

const resolveDocumentEmployeeTarget = async (req: any) => {
    const employeeId = req.params.employeeId || req.body.employeeId;

    if (!employeeId) {
        return null;
    }

    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, companyId: true }
    });

    return employee
        ? { employeeId: employee.id, companyId: employee.companyId }
        : { employeeId };
};

const resolveStoredDocumentTarget = async (req: any) => {
    const document = await prisma.document.findUnique({
        where: { id: req.params.id },
        select: {
            employeeId: true,
            employee: { select: { companyId: true } }
        }
    });

    return document
        ? { employeeId: document.employeeId, companyId: document.employee?.companyId }
        : null;
};
// ...
router.post('/generate-uniform', DocumentTemplateController.generateUniform);
router.post('/generate-epi', DocumentTemplateController.generateEPI);
router.post('/generate-tech', DocumentTemplateController.generateTech);
router.post('/generate-145', DocumentTemplateController.generate145);
router.post('/generate-nda', DocumentTemplateController.generateNDA);
router.post('/generate-rgpd', DocumentTemplateController.generateRGPD);

router.post('/upload', upload.single('file'), authorize('document.write', resolveDocumentEmployeeTarget), DocumentController.upload);
router.post('/ocr', upload.single('file'), DocumentController.processOCR);
router.get('/employee/:employeeId', authorize('document.read', resolveDocumentEmployeeTarget), DocumentController.getByEmployee);
router.get('/:id/download', authorize('document.read', resolveStoredDocumentTarget), DocumentController.download);
router.delete('/:id', authorize('document.delete', resolveStoredDocumentTarget), DocumentController.delete);

export default router;
