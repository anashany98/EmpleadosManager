import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { OffboardingService } from '../services/OffboardingService';

export const OffboardingController = {
    /**
     * Prepares offboarding data for an employee.
     */
    prepareOffboarding: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { employeeId } = req.params;
            const data = await OffboardingService.getOffboardingData(employeeId);
            return ApiResponse.success(res, data);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Completes the offboarding process.
     */
    confirmOffboarding: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { employeeId } = req.params;
            const { exitDate, reason, returnAssets } = req.body;
            const userId = (req as any).user?.id || 'SYSTEM';

            if (!exitDate || !reason) {
                return ApiResponse.error(res, 'Faltan datos obligatorios (fecha y motivo)', 400);
            }

            const result = await OffboardingService.completeOffboarding(employeeId, {
                exitDate,
                reason,
                returnAssets: returnAssets || [],
                userId
            });

            return ApiResponse.success(res, result, 'Baja de empleado tramitada correctamente');
        } catch (error) {
            next(error);
        }
    }
};
