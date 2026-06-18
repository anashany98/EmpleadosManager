import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { EmployeeController } from '../controllers/EmployeeController';
import { EmployeeMedicalController } from '../controllers/EmployeeMedicalController';
import { EmployeeTrainingController } from '../controllers/EmployeeTrainingController';
import { EmployeeImportController } from '../controllers/EmployeeImportController';
import { ContractController } from '../controllers/ContractController';
import { TimelineController } from '../controllers/TimelineController';
import { prisma } from '../lib/prisma';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit for employee Excel imports
});

const router = Router();

import { validateResource } from '../middlewares/validateResource';
import { authorize, checkPermission } from '../middlewares/authMiddleware';
import {
    createEmployeeSchema,
    employeeVacationBalanceQuerySchema,
    updateEmployeePrivateNotesSchema,
    updateEmployeeSchema,
    updateEmployeeVacationBalanceSchema
} from '../schemas/employeeSchemas';
import { idParamSchema, employeeIdParamSchema } from '../schemas/commonSchemas';

const resolveEmployeeTarget = async (req: any) => {
  const id = req.params.id || req.params.employeeId;
  const employee = await prisma.employee.findUnique({
        where: { id },
        select: { id: true, companyId: true }
    });

    return employee
        ? { employeeId: employee.id, companyId: employee.companyId }
        : { employeeId: id };
};

const importLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many import requests. Please wait before trying again.'
});

// Admin / HR Access
router.get('/', authorize('employee.read.list'), EmployeeController.getAll);
router.get('/departments', authorize('employee.read.list'), EmployeeController.getDepartments);
router.get('/options', authorize('employee.read.list'), EmployeeController.getFieldOptions);
router.get('/hierarchy', authorize('employee.read.list'), EmployeeController.getHierarchy);
router.post('/import/preview', importLimiter, checkPermission('employees', 'write'), upload.single('file'), EmployeeImportController.previewImport);
router.post('/import', importLimiter, checkPermission('employees', 'write'), upload.single('file'), EmployeeImportController.importEmployees);
router.get('/template', authorize('employee.read.list'), EmployeeImportController.downloadTemplate);

// Self-Service Capable Routes
router.get('/:id', validateResource(idParamSchema), authorize('employee.read.detail', resolveEmployeeTarget), EmployeeController.getById);
router.get('/:id/vacation-balance', validateResource(idParamSchema), validateResource(employeeVacationBalanceQuerySchema), authorize('employee.read.detail', resolveEmployeeTarget), EmployeeController.getVacationBalance);
router.get('/:id/portability-report', validateResource(idParamSchema), authorize('employee.read.detail', resolveEmployeeTarget), EmployeeController.getPortabilityReport);
router.get('/:id/private-notes/history', validateResource(idParamSchema), authorize('employee.read.sensitive', resolveEmployeeTarget), EmployeeController.getPrivateNotesHistory);
router.put('/:id/private-notes', validateResource(idParamSchema), validateResource(updateEmployeePrivateNotesSchema), authorize('employee.write.company', resolveEmployeeTarget), EmployeeController.updatePrivateNotes);
router.put('/:id/vacation-balance', validateResource(idParamSchema), validateResource(updateEmployeeVacationBalanceSchema), authorize('employee.write.company', resolveEmployeeTarget), EmployeeController.updateVacationBalance);

// Write Access (Strict) — authorize middleware added to PUT
router.post('/', checkPermission('employees', 'write'), validateResource(createEmployeeSchema), EmployeeController.create);
router.put('/:id', validateResource(idParamSchema), authorize('employee.write.company', resolveEmployeeTarget), validateResource(updateEmployeeSchema), EmployeeController.update);
router.delete('/:id', checkPermission('employees', 'write'), validateResource(idParamSchema), EmployeeController.delete);
router.post('/bulk-update', checkPermission('employees', 'write'), EmployeeController.bulkUpdate);

// Contract Management
router.post('/:id/contract/extend', checkPermission('employees', 'write'), ContractController.extend);
router.get('/:id/contract/history', authorize('employee.read.detail', resolveEmployeeTarget), ContractController.getHistory);
router.get('/:id/timeline', authorize('employee.read.detail', resolveEmployeeTarget), TimelineController.getEmployeeTimeline);

// PRL & Training Features (split into separate controllers)
router.get('/:employeeId/medical-reviews', validateResource(employeeIdParamSchema), authorize('employee.read.detail', resolveEmployeeTarget), EmployeeMedicalController.getByEmployee);
router.post('/:employeeId/medical-reviews', validateResource(employeeIdParamSchema), checkPermission('employees', 'write'), EmployeeMedicalController.create);
router.delete('/:employeeId/medical-reviews/:id', validateResource(employeeIdParamSchema), checkPermission('employees', 'write'), EmployeeMedicalController.delete);

router.get('/:employeeId/trainings', validateResource(employeeIdParamSchema), authorize('employee.read.detail', resolveEmployeeTarget), EmployeeTrainingController.getByEmployee);
router.post('/:employeeId/trainings', validateResource(employeeIdParamSchema), checkPermission('employees', 'write'), EmployeeTrainingController.create);
router.delete('/:employeeId/trainings/:id', validateResource(employeeIdParamSchema), checkPermission('employees', 'write'), EmployeeTrainingController.delete);

export default router;
