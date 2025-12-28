import { Request, Response } from 'express';
import { ContractService } from '../services/ContractService';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';

export const ContractController = {
    /**
     * POST /api/employees/:id/contract/extend
     */
    extend: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { newEndDate, notes, fileUrl } = req.body;

        if (!newEndDate) {
            throw new AppError('La nueva fecha de fin es obligatoria', 400);
        }

        const extension = await ContractService.extendContract(id, {
            newEndDate,
            notes,
            fileUrl,
        });

        return ApiResponse.success(res, extension, 'Contrato extendido correctamente', 201);
    },

    /**
     * GET /api/employees/:id/contract/history
     */
    getHistory: async (req: Request, res: Response) => {
        const { id } = req.params;
        const history = await ContractService.getContractHistory(id);
        return ApiResponse.success(res, history);
    },
};
