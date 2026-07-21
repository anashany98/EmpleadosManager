import { Request, Response } from 'express';
import { ObjectiveService } from '../services/ObjectiveService';
import { AuthenticatedRequest } from '../types/express';
import { isGlobalAdmin, getActorCompanyFilter, assertSameTenantOrGlobal } from '../utils/actorContext';

export class ObjectiveController {
    // Crear objetivo
    static async create(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            // HIGH-001: forzamos companyId del actor en create
            const data = { ...req.body, employeeId: req.body.employeeId || user?.employeeId };
            const companyFilter = getActorCompanyFilter(user);
            if (companyFilter) {
                data.companyId = companyFilter;
            }
            const objective = await ObjectiveService.createObjective(data);
            res.status(201).json(objective);
        } catch {
            res.status(400).json({ error: 'Error creating objective' });
        }
    }

    // Crear objetivo en cascada
    static async createCascade(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const data = { ...req.body, cascadeToSubordinates: req.body.cascadeToSubordinates || false };
            const companyFilter = getActorCompanyFilter(user);
            if (companyFilter) {
                data.companyId = companyFilter;
            }
            const objective = await ObjectiveService.createCascadeObjective(data);
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

            // HIGH-001: tenant check
            const objectiveCompanyId = (objective as any).employee?.companyId ?? null;
            if (!isGlobalAdmin(user) && !assertSameTenantOrGlobal(user, objectiveCompanyId)) {
                return res.status(404).json({ error: 'Objetivo no encontrado' });
            }

            // Authorization check
            const isOwner = user?.employeeId === objective.employeeId;
            const isStaff = isGlobalAdmin(user) || user?.role === 'hr' || user?.role === 'manager';

            if (!isOwner && !isStaff) {
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

            // HIGH-001: scoping por tenant
            const companyFilter = getActorCompanyFilter(user);
            if (companyFilter) {
                filters.employee = { companyId: companyFilter };
                if (user?.role === 'manager' || user?.role === 'employee') {
                    filters.OR = [
                        { employeeId: user.employeeId ?? null }
                    ];
                }
            } else if (isGlobalAdmin(user)) {
                if (req.query.employeeId) filters.employeeId = req.query.employeeId as string;
            } else {
                return res.status(403).json({ error: 'No autorizado' });
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
            // HIGH-001: scoping por tenant. Las stats por empleado
            // se filtran por tenant si el actor no es global.
            const companyFilter = getActorCompanyFilter(user);
            if (!companyFilter && !isGlobalAdmin(user)) {
                return res.status(403).json({ error: 'No autorizado' });
            }
            const employeeId = isGlobalAdmin(user) || user?.role === 'hr'
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