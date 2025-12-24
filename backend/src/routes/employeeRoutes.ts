import { Router } from 'express';
import multer from 'multer';
import { EmployeeController } from '../controllers/EmployeeController';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.get('/', EmployeeController.getAll);
router.post('/import', upload.single('file'), EmployeeController.importEmployees);
router.get('/template', EmployeeController.downloadTemplate);
router.get('/:id', EmployeeController.getById);
router.post('/', EmployeeController.create);
router.put('/:id', EmployeeController.update);
router.delete('/:id', EmployeeController.delete);

// PRL & Training Features
router.get('/:id/medical-reviews', EmployeeController.getMedicalReviews);
router.post('/:id/medical-reviews', EmployeeController.createMedicalReview);
router.delete('/:id/medical-reviews/:reviewId', EmployeeController.deleteMedicalReview);

router.get('/:id/trainings', EmployeeController.getTrainings);
router.post('/:id/trainings', EmployeeController.createTraining);
router.delete('/:id/trainings/:trainingId', EmployeeController.deleteTraining);

export default router;
