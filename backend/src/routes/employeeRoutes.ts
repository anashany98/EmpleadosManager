import { Router } from 'express';
import multer from 'multer';
import { EmployeeController } from '../controllers/EmployeeController';
import { ContractController } from '../controllers/ContractController';
import { TimelineController } from '../controllers/TimelineController';
import { prisma } from '../lib/prisma';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit for imports
});

const router = Router();

import { validateResource } from '../middlewares/validateResource';
import { authorize, checkPermission } from '../middlewares/authMiddleware';
import { createEmployeeSchema, updateEmployeeSchema } from '../schemas/employeeSchemas';
import { idParamSchema } from '../schemas/commonSchemas';

const resolveEmployeeTarget = async (req: any) => {
    const id = req.params.id;
    const employee = await prisma.employee.findUnique({
        where: { id },
        select: { id: true, companyId: true }
    });

    return employee
        ? { employeeId: employee.id, companyId: employee.companyId }
        : { employeeId: id };
};

// Admin / HR Access with rate limiting
router.get('/', authorize('employee.read.list'), EmployeeController.getAll);
router.get('/departments', authorize('employee.read.list'), EmployeeController.getDepartments);
router.get('/hierarchy', authorize('employee.read.list'), EmployeeController.getHierarchy);
router.post('/import', checkPermission('employees', 'write'), upload.single('file'), EmployeeController.importEmployees);
router.get('/template', authorize('employee.read.list'), EmployeeController.downloadTemplate);

// Self-Service Capable Routes
router.get('/:id', validateResource(idParamSchema), authorize('employee.read.detail', resolveEmployeeTarget), EmployeeController.getById);
router.get('/:id/portability-report', validateResource(idParamSchema), authorize('employee.read.detail', resolveEmployeeTarget), EmployeeController.getPortabilityReport);

// Write Access (Strict)
router.post('/', checkPermission('employees', 'write'), validateResource(createEmployeeSchema), EmployeeController.create);
router.put('/:id', validateResource(idParamSchema), validateResource(updateEmployeeSchema), EmployeeController.update);
router.patch('/:id', validateResource(idParamSchema), validateResource(updateEmployeeSchema), EmployeeController.update);
router.delete('/:id', checkPermission('employees', 'write'), validateResource(idParamSchema), EmployeeController.delete);
router.post('/bulk-update', checkPermission('employees', 'write'), EmployeeController.bulkUpdate);

// Contract Management
router.post('/:id/contract/extend', checkPermission('employees', 'write'), ContractController.extend);
router.get('/:id/contract/history', authorize('employee.read.detail', resolveEmployeeTarget), ContractController.getHistory);
router.get('/:id/timeline', authorize('employee.read.detail', resolveEmployeeTarget), TimelineController.getEmployeeTimeline);

// PRL & Training Features
router.get('/:id/medical-reviews', authorize('employee.read.detail', resolveEmployeeTarget), EmployeeController.getMedicalReviews);
router.post('/:id/medical-reviews', checkPermission('employees', 'write'), EmployeeController.createMedicalReview);
router.delete('/:id/medical-reviews/:reviewId', checkPermission('employees', 'write'), EmployeeController.deleteMedicalReview);

router.get('/:id/trainings', authorize('employee.read.detail', resolveEmployeeTarget), EmployeeController.getTrainings);
router.post('/:id/trainings', checkPermission('employees', 'write'), EmployeeController.createTraining);
router.delete('/:id/trainings/:trainingId', checkPermission('employees', 'write'), EmployeeController.deleteTraining);

export default router;