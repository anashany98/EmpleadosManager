import { Router } from 'express';
import multer from 'multer';
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
router.post('/generate-uniform', authorize('document.write', resolveDocumentEmployeeTarget), DocumentTemplateController.generateUniform);
router.post('/generate-epi', authorize('document.write', resolveDocumentEmployeeTarget), DocumentTemplateController.generateEPI);
router.post('/generate-material', authorize('document.write', resolveDocumentEmployeeTarget), DocumentTemplateController.generateMaterial);
router.post('/generate-tech', authorize('document.write', resolveDocumentEmployeeTarget), DocumentTemplateController.generateTech);
router.post('/generate-145', authorize('document.write', resolveDocumentEmployeeTarget), DocumentTemplateController.generate145);
router.post('/generate-nda', authorize('document.write', resolveDocumentEmployeeTarget), DocumentTemplateController.generateNDA);
router.post('/generate-rgpd', authorize('document.write', resolveDocumentEmployeeTarget), DocumentTemplateController.generateRGPD);

router.post('/upload', upload.single('file'), authorize('document.write', resolveDocumentEmployeeTarget), DocumentController.upload);
router.post('/ocr', upload.single('file'), DocumentController.processOCR);
router.get('/employee/:employeeId', authorize('document.read', resolveDocumentEmployeeTarget), DocumentController.getByEmployee);
router.get('/:id/download', authorize('document.read', resolveStoredDocumentTarget), DocumentController.download);
router.delete('/:id', authorize('document.delete', resolveStoredDocumentTarget), DocumentController.delete);

export default router;
