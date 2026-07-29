import { Router } from 'express';
import { DocumentTemplateController } from '../controllers/DocumentTemplateController';
import { protect, checkPermission, authorize } from '../middlewares/authMiddleware';
import { validateResource } from '../middlewares/validateResource';
import {
    documentTemplateGenerateSchema,
    documentTemplatePreviewSchema,
    documentTemplateSaveSchema
} from '../schemas/documentSchemas';
import { prisma } from '../lib/prisma';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { validateDiskUploadMiddleware } from '../config/multer';

const router = Router();

router.use(protect);

const resolveTemplateGenerationEmployeeTarget = async (req: any) => {
    const employeeId = req.body.employeeId;

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

/**
 * Resolver para /sign: el target es el `Document` indicado en el body.
 * Devuelve `{ employeeId, companyId }` del expediente asociado para
 * que `authorize('document.write', ...)` aplique la policy por recurso.
 * Si el documento no existe, devolvemos `null` (la policy falla → 403
 * uniforme; el servicio después valida de nuevo y lanza 404).
 */
const resolveSignTarget = async (req: any) => {
    const documentId = req.body?.documentId;
    if (!documentId) return null;
    const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
            id: true,
            employeeId: true,
            employee: { select: { id: true, companyId: true } }
        }
    });
    if (!document) return null;
    return {
        employeeId: document.employeeId ?? undefined,
        companyId: document.employee?.companyId ?? undefined
    };
};

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads', 'template-logos');
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

const logoUpload = multer({
    storage,
    fileFilter: (_req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo no permitido: ${ext}`));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 }
});

router.get('/list', checkPermission('documents', 'read'), DocumentTemplateController.listTemplates);
router.get('/stored', checkPermission('documents', 'read'), DocumentTemplateController.listStoredTemplates);
router.get('/variables', checkPermission('documents', 'read'), DocumentTemplateController.getAvailableVariables);
router.get('/logo', checkPermission('documents', 'read'), DocumentTemplateController.getCompanyLogo);
router.get('/:type', checkPermission('documents', 'read'), DocumentTemplateController.getTemplate);

router.post(
    '/save',
    checkPermission('documents', 'write'),
    validateResource(documentTemplateSaveSchema),
    DocumentTemplateController.saveTemplate
);
router.post('/logo', checkPermission('documents', 'write'), logoUpload.single('logo'), validateDiskUploadMiddleware('logo'), DocumentTemplateController.uploadLogo);
router.delete('/logo', checkPermission('documents', 'write'), DocumentTemplateController.removeCompanyLogo);
router.post(
    '/preview',
    checkPermission('documents', 'read'),
    validateResource(documentTemplatePreviewSchema),
    DocumentTemplateController.previewTemplate
);
router.post(
    '/generate',
    authorize('document.write', resolveTemplateGenerationEmployeeTarget),
    validateResource(documentTemplateGenerateSchema),
    DocumentTemplateController.generate
);
router.post('/sign', authorize('document.write', resolveSignTarget), DocumentTemplateController.sign);

router.delete('/:id', checkPermission('documents', 'write'), DocumentTemplateController.deleteTemplate);

export default router;
