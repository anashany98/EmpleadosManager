import { Router } from 'express';
import { CompanyController } from '../controllers/CompanyController';
import { checkPermission, requireGlobalAdmin } from '../middlewares/authMiddleware';
import { validateResource } from '../middlewares/validateResource';
import {
    companyCreateSchema,
    companyIdParamSchema,
    companyUpdateSchema,
} from '../schemas/companySchemas';

const router = Router();

router.get('/', checkPermission('companies', 'read'), CompanyController.getAll);
router.post('/', checkPermission('companies', 'write'), requireGlobalAdmin, validateResource(companyCreateSchema), CompanyController.create);
router.put('/:id', checkPermission('companies', 'write'), validateResource(companyUpdateSchema), CompanyController.update);
router.delete('/:id', checkPermission('companies', 'write'), requireGlobalAdmin, validateResource(companyIdParamSchema), CompanyController.delete);

export default router;
