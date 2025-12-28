import { Request, Response } from 'express';
import { TimelineService } from '../services/TimelineService';
import { ApiResponse } from '../utils/ApiResponse';

export const TimelineController = {
    /**
     * GET /api/employees/:id/timeline
     */
    getEmployeeTimeline: async (req: Request, res: Response) => {
        const { id } = req.params;
        const timeline = await TimelineService.getEmployeeTimeline(id);
        return ApiResponse.success(res, timeline);
    }
};
