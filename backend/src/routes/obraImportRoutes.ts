import { Router } from 'express';
import multer from 'multer';
import { ObraImportController } from '../controllers/ObraImportController';
import { checkPermission, protect, requireGlobalAdmin } from '../middlewares/authMiddleware';
import { createMulterOptions, validateUpload } from '../config/multer';
import { validateResource } from '../middlewares/validateResource';
import { obraImportBatchIdParamSchema, obraImportMappingRulesSchema } from '../schemas/obraSchemas';
import { AuthenticatedRequest } from '../types/express';
import { Request, Response, NextFunction } from 'express';

const router = Router();

// C3: Use createMulterOptions as-is (already uses memoryStorage) — no override
const upload = multer(createMulterOptions('uploads/obras/', ['.xlsx', '.xls', '.csv']));

// O3: Properly typed middleware — no more `as any`
const captureFields = (req: Request, _res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (req.body && typeof req.body.obraOverride === 'string') {
        authReq.obraOverride = req.body.obraOverride.trim() || null;
    } else {
        authReq.obraOverride = null;
    }
    next();
};

router.use(protect, requireGlobalAdmin, checkPermission('projects', 'write'));

router.get('/', ObraImportController.list);
router.get('/:id', validateResource(obraImportBatchIdParamSchema), ObraImportController.getById);
router.post('/upload', upload.single('file'), captureFields, ObraImportController.upload);
router.post('/:id/preview', validateResource(obraImportBatchIdParamSchema), validateResource(obraImportMappingRulesSchema), ObraImportController.preview);
router.post('/:id/commit', validateResource(obraImportBatchIdParamSchema), validateResource(obraImportMappingRulesSchema), ObraImportController.commit);

export default router;
