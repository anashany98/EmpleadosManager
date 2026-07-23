import { Router, type Request, type Response } from 'express';

/**
 * HIGH-004: el módulo Kiosco está desactivado por decisión funcional
 * del 20 de julio de 2026. Este router stub reemplaza al original
 * `kioskRoutes` en `registerRoutes` para garantizar que cualquier
 * petición a `/api/kiosk/*`:
 *
 *   - Sea explícitamente rechazada con 410 Gone (no 200, no 404,
 *     no 401) para que监控系统 y clientes sepan que el módulo está
 *     retirado y no disponible.
 *   - NO ejecute ninguna lógica del KioskController (que aunque
 *     conserva sus métodos, queda sin punto de entrada).
 *   - NO requiera autenticación: la respuesta es inmediata y
 *     consistente en todos los casos, lo que también blinda contra
 *     escaneos que intenten adivinar endpoints por auth.
 *
 * Los archivos originales (`kioskRoutes.ts`, `KioskController.ts`,
 * `kioskSecurityMiddleware.ts`, `KioskPage.tsx`,
 * `KioskAdminPanel.tsx`) se mantienen en disco como referencia
 * histórica y para una futura reactivación (que requerirá PIN hash
 * separado, sesión de dispositivo servidor-side, activity limitada
 * al tenant y rate-limit por empleado/dispositivo).
 */
const router = Router();

const respondGone = (_req: Request, res: Response) => {
    res.status(410).json({
        status: 'error',
        error: 'Kiosk module is disabled',
        message:
            'El módulo Kiosco no está disponible en este despliegue. Decisión funcional del 20 de julio de 2026.',
        since: '2026-07-20'
    });
};

// Bloqueamos todos los verbos que tenía el kiosco original
// (POST /auth, POST /clock, GET /activity) y cualquier otro.
router.all('*', respondGone);

export default router;
