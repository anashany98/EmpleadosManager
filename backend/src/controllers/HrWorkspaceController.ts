import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/express';
import { ApiResponse } from '../utils/ApiResponse';
import { handleControllerError } from '../utils/controllerError';
import { HrWorkspaceService } from '../services/HrWorkspaceService';
import { GlobalSearchService } from '../services/GlobalSearchService';

function auth(req: Request) {
    return (req as AuthenticatedRequest).user;
}

export const HrWorkspaceController = {
    sync: async (req: Request, res: Response) => {
        try {
            const result = await HrWorkspaceService.syncAutomaticTasks(auth(req), req.body?.companyId);
            return ApiResponse.success(res, result, 'Tareas automáticas actualizadas');
        } catch (error) {
            return handleControllerError(res, error, 'No se pudieron actualizar las tareas');
        }
    },

    overview: async (req: Request, res: Response) => {
        try {
            const result = await HrWorkspaceService.getOverview(auth(req), req.query);
            return ApiResponse.success(res, result);
        } catch (error) {
            return handleControllerError(res, error, 'No se pudo cargar el centro de tareas');
        }
    },

    createTask: async (req: Request, res: Response) => {
        try {
            const task = await HrWorkspaceService.createTask(auth(req), req.body || {});
            return ApiResponse.success(res, task, 'Tarea creada', 201);
        } catch (error) {
            return handleControllerError(res, error, 'No se pudo crear la tarea');
        }
    },

    updateTask: async (req: Request, res: Response) => {
        try {
            const task = await HrWorkspaceService.updateTask(auth(req), req.params.id, req.body || {});
            return ApiResponse.success(res, task, 'Tarea actualizada');
        } catch (error) {
            return handleControllerError(res, error, 'No se pudo actualizar la tarea');
        }
    },

    alertRules: async (req: Request, res: Response) => {
        try {
            const rules = await HrWorkspaceService.getAlertRules(auth(req), req.query.companyId as string | undefined);
            return ApiResponse.success(res, rules);
        } catch (error) {
            return handleControllerError(res, error, 'No se pudieron cargar las alertas configurables');
        }
    },

    updateAlertRule: async (req: Request, res: Response) => {
        try {
            const rule = await HrWorkspaceService.updateAlertRule(auth(req), req.params.id, req.body || {});
            return ApiResponse.success(res, rule, 'Regla de alerta actualizada');
        } catch (error) {
            return handleControllerError(res, error, 'No se pudo actualizar la alerta');
        }
    },

    alertEmailStatus: async (req: Request, res: Response) => {
        try {
            const status = await HrWorkspaceService.getAlertEmailStatus(
                auth(req),
                req.query.companyId as string | undefined
            );
            return ApiResponse.success(res, status);
        } catch (error) {
            return handleControllerError(res, error, 'No se pudo comprobar el estado del correo');
        }
    },

    monthlyClose: async (req: Request, res: Response) => {
        try {
            const now = new Date();
            const year = Number(req.query.year || now.getFullYear());
            const month = Number(req.query.month || now.getMonth() + 1);
            const close = await HrWorkspaceService.getMonthlyClose(
                auth(req),
                req.query.companyId as string | undefined,
                year,
                month
            );
            return ApiResponse.success(res, close);
        } catch (error) {
            return handleControllerError(res, error, 'No se pudo cargar el cierre mensual');
        }
    },

    updateMonthlyCloseItem: async (req: Request, res: Response) => {
        try {
            const close = await HrWorkspaceService.updateMonthlyCloseItem(
                auth(req),
                req.params.id,
                req.params.itemKey,
                Boolean(req.body?.completed)
            );
            return ApiResponse.success(res, close, 'Comprobación actualizada');
        } catch (error) {
            return handleControllerError(res, error, 'No se pudo actualizar la comprobación');
        }
    },

    setMonthlyCloseStatus: async (req: Request, res: Response) => {
        try {
            const status = String(req.body?.status || '').toUpperCase();
            if (status !== 'OPEN' && status !== 'CLOSED') {
                return ApiResponse.error(res, 'Estado de cierre no válido', 422);
            }
            const close = await HrWorkspaceService.setMonthlyCloseStatus(
                auth(req),
                req.params.id,
                status,
                req.body?.notes
            );
            return ApiResponse.success(res, close, status === 'CLOSED' ? 'Mes cerrado correctamente' : 'Mes reabierto');
        } catch (error) {
            return handleControllerError(res, error, 'No se pudo cambiar el estado del cierre');
        }
    },

    smartRecord: async (req: Request, res: Response) => {
        try {
            const record = await HrWorkspaceService.getSmartRecord(auth(req), req.params.employeeId);
            return ApiResponse.success(res, record);
        } catch (error) {
            return handleControllerError(res, error, 'No se pudo analizar el expediente');
        }
    },

    search: async (req: Request, res: Response) => {
        try {
            const results = await GlobalSearchService.search(
                auth(req),
                String(req.query.q || ''),
                req.query.companyId as string | undefined
            );
            return ApiResponse.success(res, results);
        } catch (error) {
            return handleControllerError(res, error, 'No se pudo realizar la búsqueda');
        }
    }
};
