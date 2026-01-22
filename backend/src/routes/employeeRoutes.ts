import { Router } from 'express';
import multer from 'multer';
import { EmployeeController } from '../controllers/EmployeeController';
import { ContractController } from '../controllers/ContractController';
import { TimelineController } from '../controllers/TimelineController';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit for imports
});

const router = Router();

import { validateResource } from '../middlewares/validateResource';
import { createEmployeeSchema, updateEmployeeSchema } from '../schemas/employeeSchemas';

router.get('/', EmployeeController.getAll);
router.get('/departments', EmployeeController.getDepartments);
router.get('/hierarchy', EmployeeController.getHierarchy);
router.post('/import', upload.single('file'), EmployeeController.importEmployees);
router.get('/template', EmployeeController.downloadTemplate);
router.get('/:id', EmployeeController.getById);
router.get('/:id/portability-report', EmployeeController.getPortabilityReport);
router.post('/', validateResource(createEmployeeSchema), EmployeeController.create);
router.put('/:id', validateResource(updateEmployeeSchema), EmployeeController.update);
router.patch('/:id', validateResource(updateEmployeeSchema), EmployeeController.update);
router.delete('/:id', EmployeeController.delete);
router.post('/bulk-update', EmployeeController.bulkUpdate);

// Contract Management
router.post('/:id/contract/extend', ContractController.extend);
router.get('/:id/contract/history', ContractController.getHistory);
router.get('/:id/timeline', TimelineController.getEmployeeTimeline);

// PRL & Training Features
router.get('/:id/medical-reviews', EmployeeController.getMedicalReviews);
router.post('/:id/medical-reviews', EmployeeController.createMedicalReview);
router.delete('/:id/medical-reviews/:reviewId', EmployeeController.deleteMedicalReview);

router.get('/:id/trainings', EmployeeController.getTrainings);
router.post('/:id/trainings', EmployeeController.createTraining);
router.delete('/:id/trainings/:trainingId', EmployeeController.deleteTraining);

export default router;
