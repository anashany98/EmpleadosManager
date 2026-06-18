import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/express';
import { DataPortabilityService } from '../services/DataPortabilityService';
import { ApiResponse } from '../utils/ApiResponse';
import { createLogger } from '../services/LoggerService';

const log = createLogger('DataPortabilityController');

/**
 * GDPR Art.20 — Right to Data Portability
 *
 * GET /api/me/export
 *
 * Returns the authenticated employee's own personal data in a
 * structured, machine-readable JSON format. The employee can use
 * this to port their data to another controller.
 */
export async function exportMyData(req: Request, res: Response) {
    try {
        const { user } = req as AuthenticatedRequest;
        const data = await DataPortabilityService.getMyDataPortability(user);

        // Set headers for downloadable JSON
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="portabilidad-datos-${new Date().toISOString().slice(0, 10)}.json"`);

        return res.json(data);
    } catch (error: any) {
        log.error({ error }, 'Error exporting personal data (GDPR Art.20)');
        return ApiResponse.error(res, error.message || 'Error al exportar datos personales', error.statusCode || 500);
    }
}

export const DataPortabilityController = {
    exportMyData
};
