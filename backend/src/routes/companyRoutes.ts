import { Router } from 'express';
import { CompanyController } from '../controllers/CompanyController';

const router = Router();

router.get('/', CompanyController.getAll);
router.post('/', CompanyController.create);
router.put('/:id', CompanyController.update);
router.delete('/:id', CompanyController.delete);

export default router;
