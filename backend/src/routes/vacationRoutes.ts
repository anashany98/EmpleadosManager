import { Router } from 'express';
import { VacationController } from '../controllers/VacationController';
import { protect } from '../middlewares/authMiddleware';

import multer from 'multer';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const router = Router();

// Todas las rutas requieren autenticación
router.use(protect);

import { restrictTo } from '../middlewares/authMiddleware';

router.get('/', restrictTo('admin', 'hr'), VacationController.getAll);
router.get('/my-vacations', VacationController.getMyVacations);
router.get('/manage', VacationController.getManageableVacations);
router.get('/employee/:employeeId', VacationController.getByEmployee);
router.post('/', upload.single('attachment'), VacationController.create);
router.delete('/:id', VacationController.delete);
router.put('/:id/status', VacationController.updateStatus);
router.get('/:id/attachment', VacationController.downloadAttachment);

export default router;
