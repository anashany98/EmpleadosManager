import { Router } from 'express';
import { MappingProfileController } from '../controllers/MappingProfileController';
import { FileMappingController } from '../controllers/FileMappingController';
import { requireGlobalAdmin, checkPermission } from '../middlewares/authMiddleware';

const router = Router();
const controller = new MappingProfileController();

router.get('/', checkPermission('payroll', 'read'), controller.getProfiles);
router.post('/', requireGlobalAdmin, controller.createProfile);
router.delete('/:id', requireGlobalAdmin, controller.deleteProfile);

router.get('/file-mappings', checkPermission('payroll', 'read'), FileMappingController.getAll);
router.post('/file-mappings', checkPermission('payroll', 'write'), FileMappingController.create);
router.put('/file-mappings/:id', checkPermission('payroll', 'write'), FileMappingController.update);
router.delete('/file-mappings/:id', checkPermission('payroll', 'write'), FileMappingController.delete);

export default router;