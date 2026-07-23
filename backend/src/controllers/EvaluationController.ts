import { Request, Response } from 'express';
import { EvaluationService } from '../services/EvaluationService';
import { AuthenticatedRequest } from '../types/express';
import {
    isGlobalAdmin,
    getActorCompanyFilter,
    assertSameTenantOrGlobal
} from '../utils/actorContext';

export class EvaluationController {
    // Crear evaluación
    static async create(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const data = req.body;
            // HIGH-001: forzamos companyId del actor en create para
            // que un admin de A no pueda crear evaluaciones
            // vinculadas a un empleado de B.
            const companyFilter = getActorCompanyFilter(user);
            if (companyFilter) {
                data.companyId = companyFilter;
            }
            const evaluation = await EvaluationService.createEvaluation(data);
            res.status(201).json(evaluation);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    // Obtener evaluación por ID
    static async getById(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const evaluation = await EvaluationService.getEvaluationById(req.params.id);
            if (!evaluation) {
                return res.status(404).json({ error: 'Evaluación no encontrada' });
            }

            // HIGH-001: comprobamos tenant del recurso + employee.
            // Admin global (sin companyId) sigue viendo todo.
            // HR/admin con companyId solo ve los de su empresa.
            // Manager/employee: solo los propios (employeeId === user.employeeId).
            const tenantCompanyId = evaluation.employee?.companyId ?? null;
            if (!isGlobalAdmin(user)) {
                if (!assertSameTenantOrGlobal(user, tenantCompanyId)) {
                    return res.status(404).json({ error: 'Evaluación no encontrada' });
                }
            }

            // Además del tenant, verificamos ownership para
            // managers/empleados:
            const isOwner = user?.employeeId === evaluation.employee?.id;
            const isEvaluator = user?.employeeId === evaluation.evaluator?.id;
            const isStaff = user?.role === 'admin' || user?.role === 'hr';

            if (!isOwner && !isEvaluator && !isStaff) {
                return res.status(403).json({ error: 'No tienes permiso para ver esta evaluación' });
            }

            res.json(evaluation);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    // Listar evaluaciones
    static async list(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const filters: any = {};

            // HIGH-001: scoping por tenant. Antes, `user?.role !== 'admin'`
            // era la única restricción, lo que permitía a un admin
            // de A listar evaluaciones de B. Ahora el filtro se
            // construye a partir de `getActorCompanyFilter(user)`.
            const companyFilter = getActorCompanyFilter(user);

            if (companyFilter) {
                // Filtramos por empleados del propio tenant. Esto
                // requiere cambiar la query a `employee.companyId`,
                // que `EvaluationService.listEvaluations` no soporta
                // todavía — por ahora lo hacemos aquí con un
                // filtro por empleados, y la verificación final
                // se hace en el servicio cuando se cargue.
                filters.employee = { companyId: companyFilter };
                // Adicionalmente, un manager/empleado solo ve los suyos
                if (user?.role === 'manager' || user?.role === 'employee') {
                    filters.OR = [
                        { employeeId: user.employeeId ?? null },
                        { evaluatorId: user.employeeId ?? null }
                    ];
                }
            } else if (isGlobalAdmin(user)) {
                // Admin global: sin filtro de tenant.
                if (req.query.employeeId) filters.employeeId = req.query.employeeId as string;
                if (req.query.evaluatorId) filters.evaluatorId = req.query.evaluatorId as string;
            } else {
                // Sin tenant y sin global: deny-by-default.
                return res.status(403).json({ error: 'No autorizado' });
            }

            if (req.query.status) filters.status = req.query.status as string;
            if (req.query.templateId) filters.templateId = req.query.templateId as string;
            if (req.query.periodStart) filters.periodStart = new Date(req.query.periodStart as string);
            if (req.query.periodEnd) filters.periodEnd = new Date(req.query.periodEnd as string);

            const evaluations = await EvaluationService.listEvaluations(filters);
            res.json(evaluations);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    // Actualizar evaluación
    static async update(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            // Cargamos la evaluación y validamos tenant ANTES de
            // pasarla al servicio.
            const existing = await EvaluationService.getEvaluationById(req.params.id);
            if (!existing) {
                return res.status(404).json({ error: 'Evaluación no encontrada' });
            }
            if (!assertSameTenantOrGlobal(user, existing.employee?.companyId)) {
                return res.status(404).json({ error: 'Evaluación no encontrada' });
            }
            const evaluation = await EvaluationService.updateEvaluation(req.params.id, req.body);
            res.json(evaluation);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    // Enviar autoevaluación
    static async submitSelfEvaluation(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const evaluation = await EvaluationService.getEvaluationById(req.params.id);

            if (!evaluation) {
                return res.status(404).json({ error: 'Evaluación no encontrada' });
            }

            // HIGH-001: tenant check antes que nada
            if (!assertSameTenantOrGlobal(user, evaluation.employee?.companyId)) {
                return res.status(404).json({ error: 'Evaluación no encontrada' });
            }

            // Solo el empleado evaluado puede enviar la autoevaluación
            if (user?.employeeId !== evaluation.employee?.id) {
                return res.status(403).json({ error: 'Solo el empleado evaluado puede enviar la autoevaluación' });
            }

            const { selfScores, strengths, improvements } = req.body;
            const result = await EvaluationService.submitSelfEvaluation(
                req.params.id,
                selfScores,
                strengths,
                improvements
            );
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    // Enviar evaluación del manager
    static async submitManagerEvaluation(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const evaluation = await EvaluationService.getEvaluationById(req.params.id);

            if (!evaluation) {
                return res.status(404).json({ error: 'Evaluación no encontrada' });
            }

            // HIGH-001: tenant check antes que nada
            if (!assertSameTenantOrGlobal(user, evaluation.employee?.companyId)) {
                return res.status(404).json({ error: 'Evaluación no encontrada' });
            }

            // Solo el evaluador asignado, un admin/HR del mismo tenant,
            // o un admin global puede enviar la evaluación
            const isAssignedEvaluator = user?.employeeId === evaluation.evaluator?.id;
            const isStaff = isGlobalAdmin(user) || (user?.role === 'hr' && assertSameTenantOrGlobal(user, evaluation.employee?.companyId));
            if (!isAssignedEvaluator && !isStaff) {
                return res.status(403).json({ error: 'Solo el evaluador asignado puede enviar la evaluación' });
            }

            const { managerScores, managerComments } = req.body;
            const result = await EvaluationService.submitManagerEvaluation(
                req.params.id,
                managerScores,
                managerComments
            );
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    // Confirmar evaluación
    static async acknowledge(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const evaluation = await EvaluationService.getEvaluationById(req.params.id);

            if (!evaluation) {
                return res.status(404).json({ error: 'Evaluación no encontrada' });
            }

            // HIGH-001: tenant check antes que nada
            if (!assertSameTenantOrGlobal(user, evaluation.employee?.companyId)) {
                return res.status(404).json({ error: 'Evaluación no encontrada' });
            }

            // Solo el empleado evaluado puede confirmar
            if (user?.employeeId !== evaluation.employee?.id) {
                return res.status(403).json({ error: 'Solo el empleado evaluado puede confirmar la evaluación' });
            }

            const result = await EvaluationService.acknowledgeEvaluation(req.params.id);
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    // Crear evaluaciones masivas
    static async createBulk(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            // HIGH-001: scoping por tenant. Si el body trae un
            // `companyId` explícito, lo sobreescribimos con el del
            // actor (a menos que sea admin global).
            const companyFilter = getActorCompanyFilter(user);
            const data = { ...req.body };
            if (companyFilter) {
                data.companyId = companyFilter;
            }
            const evaluations = await EvaluationService.createBulkEvaluations(data);
            res.status(201).json({
                message: `${evaluations.length} evaluaciones creadas`,
                evaluations
            });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    // Obtener estadísticas
    static async getStats(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const filters: any = {};

            // HIGH-001: scoping por tenant
            const companyFilter = getActorCompanyFilter(user);
            if (companyFilter) {
                filters.employee = { companyId: companyFilter };
            } else if (!isGlobalAdmin(user)) {
                return res.status(403).json({ error: 'No autorizado' });
            }

            if (req.query.department) filters.department = req.query.department as string;
            if (req.query.periodStart) filters.periodStart = new Date(req.query.periodStart as string);
            if (req.query.periodEnd) filters.periodEnd = new Date(req.query.periodEnd as string);

            const stats = await EvaluationService.getEvaluationStats(filters);
            res.json(stats);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }
}
