import { Request, Response } from 'express';
import { EvaluationService } from '../services/EvaluationService';
import { AuthenticatedRequest } from '../types/express';

export class EvaluationController {
    // Crear evaluación
    static async create(req: Request, res: Response) {
        try {
            const evaluation = await EvaluationService.createEvaluation(req.body);
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
            
            // Authorization: only admin, hr, evaluator, or the evaluated employee can view
            const isOwner = user?.employeeId === evaluation.employee.id;
            const isEvaluator = user?.employeeId === evaluation.evaluator.id;
            const isAdmin = user?.role === 'admin';
            
            if (!isOwner && !isEvaluator && !isAdmin) {
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
            
            // Non-admin users can only see their own evaluations or ones they're evaluating
            if (user?.role !== 'admin') {
                // Return evaluations where user is either the employee or evaluator
                filters.OR = [
                    { employeeId: user?.employeeId },
                    { evaluatorId: user?.employeeId }
                ];
            }
            
            // Allow additional filters for admins
            if (user?.role === 'admin') {
                if (req.query.employeeId) filters.employeeId = req.query.employeeId as string;
                if (req.query.evaluatorId) filters.evaluatorId = req.query.evaluatorId as string;
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
            
            // Only the evaluated employee can submit self-evaluation
            if (user?.employeeId !== evaluation.employee.id && user?.role !== 'admin') {
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
            
            // Only the assigned evaluator or admin can submit manager evaluation
            if (user?.employeeId !== evaluation.evaluator.id && user?.role !== 'admin') {
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
            
            // Only the evaluated employee can acknowledge
            if (user?.employeeId !== evaluation.employee.id && user?.role !== 'admin') {
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
            const evaluations = await EvaluationService.createBulkEvaluations(req.body);
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
            const filters: any = {};
            
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