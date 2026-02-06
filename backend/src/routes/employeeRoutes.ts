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
import { checkPermission, allowSelfOrRole } from '../middlewares/authMiddleware';
import { createEmployeeSchema, updateEmployeeSchema } from '../schemas/employeeSchemas';

// Admin / HR Access
router.get('/', checkPermission('employees', 'read'), EmployeeController.getAll);
router.get('/departments', checkPermission('employees', 'read'), EmployeeController.getDepartments);
router.get('/hierarchy', checkPermission('employees', 'read'), EmployeeController.getHierarchy);
router.post('/import', checkPermission('employees', 'write'), upload.single('file'), EmployeeController.importEmployees);
router.get('/template', checkPermission('employees', 'read'), EmployeeController.downloadTemplate);

// Self-Service Capable Routes
router.get('/:id', allowSelfOrRole(['admin'], 'id'), EmployeeController.getById);
router.get('/:id/portability-report', allowSelfOrRole(['admin'], 'id'), EmployeeController.getPortabilityReport);

// Write Access (Strict)
router.post('/', checkPermission('employees', 'write'), validateResource(createEmployeeSchema), EmployeeController.create);
router.put('/:id', checkPermission('employees', 'write'), validateResource(updateEmployeeSchema), EmployeeController.update);
router.patch('/:id', checkPermission('employees', 'write'), validateResource(updateEmployeeSchema), EmployeeController.update);
router.delete('/:id', checkPermission('employees', 'write'), EmployeeController.delete);
router.post('/bulk-update', checkPermission('employees', 'write'), EmployeeController.bulkUpdate);

// Contract Management
router.post('/:id/contract/extend', checkPermission('employees', 'write'), ContractController.extend);
router.get('/:id/contract/history', allowSelfOrRole(['admin'], 'id'), ContractController.getHistory); // Employee can see own contract?
router.get('/:id/timeline', allowSelfOrRole(['admin'], 'id'), TimelineController.getEmployeeTimeline);

// PRL & Training Features (Self-Service Read?)
router.get('/:id/medical-reviews', allowSelfOrRole(['admin'], 'id'), EmployeeController.getMedicalReviews);
router.post('/:id/medical-reviews', checkPermission('employees', 'write'), EmployeeController.createMedicalReview);
router.delete('/:id/medical-reviews/:reviewId', checkPermission('employees', 'write'), EmployeeController.deleteMedicalReview);

router.get('/:id/trainings', allowSelfOrRole(['admin'], 'id'), EmployeeController.getTrainings);
router.post('/:id/trainings', checkPermission('employees', 'write'), EmployeeController.createTraining);
router.delete('/:id/trainings/:trainingId', checkPermission('employees', 'write'), EmployeeController.deleteTraining);

export default router;
