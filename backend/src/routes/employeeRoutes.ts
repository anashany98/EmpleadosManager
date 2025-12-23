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

export default router;
