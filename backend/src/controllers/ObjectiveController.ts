import { Request, Response } from 'express';
import { ObjectiveService } from '../services/ObjectiveService';
import { AuthenticatedRequest } from '../types/express';

export class ObjectiveController {
    // Crear objetivo
    static async create(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const objective = await ObjectiveService.createObjective({
                ...req.body,
                employeeId: req.body.employeeId || user?.employeeId
            });
            res.status(201).json(objective);
        } catch {
            res.status(400).json({ error: 'Error creating objective' });
        }
    }

    // Crear objetivo en cascada
    static async createCascade(req: Request, res: Response) {
        try {
            const objective = await ObjectiveService.createCascadeObjective({
                ...req.body,
                cascadeToSubordinates: req.body.cascadeToSubordinates || false
            });
            res.status(201).json(objective);
        } catch {
            res.status(400).json({ error: 'Error creating cascade objective' });
        }
    }

    // Obtener objetivo por ID
    static async getById(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const objective = await ObjectiveService.getObjectiveById(req.params.id);
            if (!objective) {
                return res.status(404).json({ error: 'Objetivo no encontrado' });
            }

            // Authorization check
            const isOwner = user?.employeeId === objective.employeeId;
            const isAdmin = user?.role === 'admin';

            if (!isOwner && !isAdmin) {
                return res.status(403).json({ error: 'No tienes permiso para ver este objetivo' });
            }

            res.json(objective);
        } catch {
            res.status(400).json({ error: 'Error getting objective' });
        }
    }

    // Listar objetivos
    static async list(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const filters: any = {};

            // Non-admin users can only see their own objectives
            if (user?.role !== 'admin') {
                filters.employeeId = user?.employeeId;
            } else if (req.query.employeeId) {
                filters.employeeId = req.query.employeeId as string;
            }

            if (req.query.status) filters.status = req.query.status as string;
            if (req.query.category) filters.category = req.query.category as string;
            if (req.query.dueDateFrom) filters.dueDateFrom = new Date(req.query.dueDateFrom as string);
            if (req.query.dueDateTo) filters.dueDateTo = new Date(req.query.dueDateTo as string);

            const objectives = await ObjectiveService.listObjectives(filters);
            res.json(objectives);
        } catch {
            res.status(400).json({ error: 'Error listing objectives' });
        }
    }

    // Actualizar objetivo
    static async update(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const objective = await ObjectiveService.getObjectiveById(req.params.id);

            if (!objective) {
                return res.status(404).json({ error: 'Objetivo no encontrado' });
            }

            // Only owner or admin can update
            if (user?.employeeId !== objective.employeeId && user?.role !== 'admin') {
                return res.status(403).json({ error: 'No tienes permiso para modificar este objetivo' });
            }

            const result = await ObjectiveService.updateObjective(req.params.id, req.body);
            res.json(result);
        } catch {
            res.status(400).json({ error: 'Error updating objective' });
        }
    }

    // Actualizar progreso
    static async updateProgress(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const objective = await ObjectiveService.getObjectiveById(req.params.id);

            if (!objective) {
                return res.status(404).json({ error: 'Objetivo no encontrado' });
            }

            // Only owner or admin can update progress
            if (user?.employeeId !== objective.employeeId && user?.role !== 'admin') {
                return res.status(403).json({ error: 'No tienes permiso para modificar este objetivo' });
            }

            const { progress, actualValue } = req.body;
            const result = await ObjectiveService.updateProgress(
                req.params.id,
                progress,
                actualValue
            );
            res.json(result);
        } catch {
            res.status(400).json({ error: 'Error updating progress' });
        }
    }

    // Eliminar objetivo
    static async delete(req: Request, res: Response) {
        try {
            await ObjectiveService.deleteObjective(req.params.id);
            res.status(204).send();
        } catch {
            res.status(400).json({ error: 'Error deleting objective' });
        }
    }

    // Obtener estadísticas
    static async getStats(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            // Non-admin users can only see their own stats
            const employeeId = user?.role === 'admin'
                ? (req.query.employeeId as string | undefined)
                : user?.employeeId;

            const stats = await ObjectiveService.getObjectiveStats(employeeId);
            res.json(stats);
        } catch {
            res.status(400).json({ error: 'Error getting stats' });
        }
    }

    // Obtener objetivos vencidos
    static async getOverdue(req: Request, res: Response) {
        try {
            const objectives = await ObjectiveService.getOverdueObjectives();
            res.json(objectives);
        } catch {
            res.status(400).json({ error: 'Error getting overdue objectives' });
        }
    }
}