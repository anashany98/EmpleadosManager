import { Request, Response } from 'express';
import { TimelineService } from '../services/TimelineService';
import { ApiResponse } from '../utils/ApiResponse';
import { handleControllerError } from '../utils/controllerError';

export const TimelineController = {
    /**
     * GET /api/employees/:id/timeline
     */
    getEmployeeTimeline: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const timeline = await TimelineService.getEmployeeTimeline(id);
            return ApiResponse.success(res, timeline);
        } catch (error) {
            // MED-007: helper centralizado que censura 5xx,
            // añade correlation ID y maneja Prisma P2002.
            return handleControllerError(res, error, 'Error al obtener el historial del empleado');
        }
    }
};
