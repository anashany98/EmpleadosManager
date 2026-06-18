import { Router } from 'express';
import { DataPortabilityController } from '../controllers/DataPortabilityController';

const router = Router();

/**
 * GDPR Art.20 — Right to Data Portability
 *
 * GET /api/me/export
 *
 * Returns the authenticated employee's personal data in a
 * structured, machine-readable JSON format.
 *
 * Authentication: required (any authenticated employee)
 * Authorization: self-only (employees can only export their own data)
 */
router.get('/export', DataPortabilityController.exportMyData);

export default router;
