import { Router } from 'express';
import { ConsentController } from '../controllers/ConsentController';
import { protect } from '../middlewares/authMiddleware';
import { validateResource } from '../middlewares/validateResource';
import { consentGrantSchema, consentIdParamSchema } from '../schemas/consentSchemas';

const router = Router();

/**
 * GDPR consent endpoints. All require authentication. Employees can
 * view and withdraw their own consents. Only global admins can
 * record consent ON BEHALF of an employee (e.g. during onboarding
 * with a paper form).
 *
 * Withdrawal of consent must be at least as easy as giving it
 * (GDPR Art. 7(3)). Since the record is immutable, withdrawal is
 * just `POST /api/consents/withdraw` (or `POST /api/consents` with
 * `granted: false`).
 */
router.use(protect);

router.get('/purposes', ConsentController.listPurposes);
router.get('/me', ConsentController.getMyConsents);
router.get('/employee/:employeeId', ConsentController.getForEmployee);
router.post('/', validateResource(consentGrantSchema), ConsentController.grantOrWithdraw);
router.post('/withdraw', validateResource(consentGrantSchema), ConsentController.withdraw);
router.delete('/:id', validateResource(consentIdParamSchema), ConsentController.delete);

export default router;
