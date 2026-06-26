import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ReportController } from '../controllers/ReportController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

/**
 * Reports router
 *
 * Security (fixed 2026-06-18 — critical finding from permissions audit):
 *   - All endpoints require authentication (`protect`).
 *   - All endpoints require the `reports:read` permission.
 *   - Rate-limited per-user to prevent DoS via expensive aggregations.
 *   - Company scope is enforced by the controller via resolveAuthorizedCompanyId()
 *     so a non-global-admin can only see their own company's data.
 *
 * The `protect` middleware populates `req.user`. Without it, `resolveAuthorizedCompanyId`
 * throws a 403 "Usuario sin empresa asignada" which is technically correct but:
 *   1. Does not differentiate "no auth" from "no access" (both 403).
 *   2. Cannot rate-limit per-user (attacker can hammer unauthenticated).
 *   3. Cannot audit which user accessed which report.
 *
 * Global admins (no `companyId`) get the full data set; company-scoped users only
 * see their own company.
 */

const router = Router();

// NOTE: protect + checkPermission('reports', 'read') are already applied
// at the app level in registerRoutes.ts. No duplicate middleware here.

// Per-user rate limit. Reports can be DB-intensive (joins over TimeEntry,
 // Vacation, PayrollRow) so we cap at 30 req/min/user to avoid DoS by
 // legitimate users AND to slow down reconnaissance by authenticated attackers.
 const reportLimiter = rateLimit({
     windowMs: 60 * 1000,
     max: 30,
     standardHeaders: true,
     legacyHeaders: false,
     keyGenerator: (req) => {
         const user = (req as { user?: { id?: string } }).user;
         // Usar ipKeyGenerator correctamente para soportar IPv6 (evita ERR_ERL_KEY_GEN_IPV6)
         return user?.id ?? ipKeyGenerator(req.ip ?? '0.0.0.0', 56);
     },
     message: { error: 'Demasiadas solicitudes de reportes. Inténtalo de nuevo en un minuto.' }
 });

router.use(reportLimiter);

router.get('/attendance', ReportController.getAttendance);
router.get('/attendance-summary', ReportController.getAttendanceSummary);
router.get('/overtime', ReportController.getOvertime);
router.get('/vacations', ReportController.getVacations);
router.get('/vacations/usage-by-department', ReportController.getVacationUsageByDepartment);
router.get('/costs', ReportController.getCosts);
router.get('/absences-detailed', ReportController.getDetailedAbsences);
router.get('/kpis', ReportController.getKPIs);
router.get('/gender-gap', ReportController.getGenderGap);

export default router;