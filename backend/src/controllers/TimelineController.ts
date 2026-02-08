import { Request, Response } from 'express';
import { TimelineService } from '../services/TimelineService';
import { ApiResponse } from '../utils/ApiResponse';
import { createLogger } from '../services/LoggerService';

const log = createLogger('TimelineController');

export const TimelineController = {
    /**
     * GET /api/employees/:id/timeline
     */
    getEmployeeTimeline: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const timeline = await TimelineService.getEmployeeTimeline(id);
            return ApiResponse.success(res, timeline);
        } catch (error: any) {
            log.error({ error }, 'Error fetching employee timeline');
            return ApiResponse.error(res, error.message || 'Error al obtener el historial del empleado', 500);
        }
    }
};
