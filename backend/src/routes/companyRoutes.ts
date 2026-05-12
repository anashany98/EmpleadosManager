import { Router } from 'express';
import { CompanyController } from '../controllers/CompanyController';
import { checkPermission, requireGlobalAdmin } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', checkPermission('companies', 'read'), CompanyController.getAll);
router.post('/', checkPermission('companies', 'write'), requireGlobalAdmin, CompanyController.create);
router.put('/:id', checkPermission('companies', 'write'), CompanyController.update);
router.delete('/:id', checkPermission('companies', 'write'), requireGlobalAdmin, CompanyController.delete);

export default router;
