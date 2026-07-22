import { Router } from 'express';
import { ObraExpenseController } from '../controllers/ObraExpenseController';
import { checkPermission, protect, requireGlobalAdmin } from '../middlewares/authMiddleware';
import { validateResource } from '../middlewares/validateResource';
import {
    obraExpenseUpdateSchema,
    obraExpenseIdParamSchema,
    obraExpenseListAllSchema
} from '../schemas/obraSchemas';

const router = Router();

router.use(protect, requireGlobalAdmin, checkPermission('projects', 'read'));

router.get('/', checkPermission('projects', 'read'), validateResource(obraExpenseListAllSchema), ObraExpenseController.listAll);
router.patch('/:id', checkPermission('projects', 'write'), validateResource(obraExpenseIdParamSchema), validateResource(obraExpenseUpdateSchema), ObraExpenseController.update);
router.delete('/:id', checkPermission('projects', 'write'), validateResource(obraExpenseIdParamSchema), ObraExpenseController.delete);

export default router;
