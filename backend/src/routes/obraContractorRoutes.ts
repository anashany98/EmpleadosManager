import { Router } from 'express';
import { ObraContractorController } from '../controllers/ObraContractorController';
import { checkPermission, protect, requireGlobalAdmin } from '../middlewares/authMiddleware';
import { validateResource } from '../middlewares/validateResource';
import {
    contractorCreateSchema,
    contractorUpdateSchema,
    contractorIdParamSchema,
    contractorListQuerySchema
} from '../schemas/obraSchemas';

const router = Router();

router.use(protect, requireGlobalAdmin, checkPermission('projects', 'read'));

router.get('/', checkPermission('projects', 'read'), validateResource(contractorListQuerySchema), ObraContractorController.list);
router.get('/:id', checkPermission('projects', 'read'), validateResource(contractorIdParamSchema), ObraContractorController.getById);
router.post('/', checkPermission('projects', 'write'), validateResource(contractorCreateSchema), ObraContractorController.create);
router.patch(
    '/:id',
    checkPermission('projects', 'write'),
    validateResource(contractorIdParamSchema),
    validateResource(contractorUpdateSchema),
    ObraContractorController.update
);
router.delete('/:id', checkPermission('projects', 'write'), validateResource(contractorIdParamSchema), ObraContractorController.delete);

export default router;
