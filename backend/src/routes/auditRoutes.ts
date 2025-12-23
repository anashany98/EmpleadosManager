import { Router } from 'express';
import { AuditController } from '../controllers/AuditController';

const router = Router();

router.get('/:entity/:entityId', AuditController.getLogs);

export default router;
