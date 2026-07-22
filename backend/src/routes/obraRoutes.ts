import { Router } from 'express';
import { ObraController } from '../controllers/ObraController';
import { ObraExpenseController } from '../controllers/ObraExpenseController';
import { checkPermission, protect, requireGlobalAdmin } from '../middlewares/authMiddleware';
import { validateResource } from '../middlewares/validateResource';
import { z } from 'zod';
import {
    obraCreateSchema,
    obraUpdateSchema,
    obraIdParamSchema,
    obraListQuerySchema,
    obraExpenseCreateSchema,
    obraExpenseUpdateSchema,
    obraExpenseListByObraSchema
} from '../schemas/obraSchemas';

const obraIdInParams = z.object({ params: z.object({ obraId: z.string().min(1) }) });

const router = Router();

router.use(protect, requireGlobalAdmin, checkPermission('projects', 'read'));

router.get('/', validateResource(obraListQuerySchema), ObraController.list);
router.get('/:id', validateResource(obraIdParamSchema), ObraController.getById);
router.post('/', checkPermission('projects', 'write'), validateResource(obraCreateSchema), ObraController.create);
router.patch(
    '/:id',
    checkPermission('projects', 'write'),
    validateResource(obraIdParamSchema),
    validateResource(obraUpdateSchema),
    ObraController.update
);
router.post('/:id/close', checkPermission('projects', 'write'), validateResource(obraIdParamSchema), ObraController.close);
router.post('/:id/reopen', checkPermission('projects', 'write'), validateResource(obraIdParamSchema), ObraController.reopen);

router.get(
    '/:obraId/expenses',
    checkPermission('projects', 'read'),
    validateResource(obraExpenseListByObraSchema),
    ObraExpenseController.listByObra
);
router.post(
    '/:obraId/expenses',
    checkPermission('projects', 'write'),
    validateResource(obraIdInParams),
    validateResource(obraExpenseCreateSchema),
    ObraExpenseController.create
);

export default router;
