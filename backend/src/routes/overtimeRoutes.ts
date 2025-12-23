import { Router } from 'express';
import multer from 'multer';
import { RateController, OvertimeController } from '../controllers/OvertimeController';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// Rates
router.get('/rates', RateController.getAll);
router.post('/rates', RateController.update);

// Overtime Entries
router.get('/employee/:employeeId', OvertimeController.getByEmployee);
router.post('/', OvertimeController.create);
router.post('/import', upload.single('file'), OvertimeController.importOvertime);
router.delete('/:id', OvertimeController.delete);

export default router;
