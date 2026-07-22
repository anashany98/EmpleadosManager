import { Router } from 'express';
import { employeeProjectWorkController } from '../controllers/EmployeeProjectWorkController';
import { checkPermission } from '../middlewares/authMiddleware';
import { validateResource } from '../middlewares/validateResource';
import { z } from 'zod';
import { employeeProjectWorkCreateSchema, employeeProjectWorkIdParamSchema, employeeProjectWorkUpdateSchema } from '../schemas/obraSchemas';

const router = Router();

router.get('/employee/:employeeId', checkPermission('projects', 'read'), employeeProjectWorkController.getByEmployee);
router.get(
    '/project/:projectId',
    checkPermission('projects', 'read'),
    validateResource(z.object({ params: z.object({ projectId: z.string().min(1) }) })),
    employeeProjectWorkController.listByProject
);
router.post(
    '/',
    checkPermission('projects', 'write'),
    validateResource(employeeProjectWorkCreateSchema),
    employeeProjectWorkController.create
);
router.patch(
    '/:id',
    checkPermission('projects', 'write'),
    validateResource(employeeProjectWorkIdParamSchema),
    validateResource(employeeProjectWorkUpdateSchema),
    employeeProjectWorkController.update
);
router.delete('/:id', checkPermission('projects', 'write'), employeeProjectWorkController.delete);

export default router;
