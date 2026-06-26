import { Router } from 'express';
import { AbsenceTypeConfigController } from '../controllers/AbsenceTypeConfigController';
import { protect, requireGlobalAdmin } from '../middlewares/authMiddleware';

const router = Router();

router.use(protect);

router.get('/', AbsenceTypeConfigController.getAll);
router.get('/active', AbsenceTypeConfigController.getActive);
router.post('/', requireGlobalAdmin, AbsenceTypeConfigController.create);
router.put('/:id', requireGlobalAdmin, AbsenceTypeConfigController.update);
router.delete('/:id', requireGlobalAdmin, AbsenceTypeConfigController.delete);

export default router;
