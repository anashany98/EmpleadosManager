import { Request, Response } from 'express';
import { PDIService } from '../services/PDIService';
import { AuthenticatedRequest } from '../types/express';
import { isGlobalAdmin, getActorCompanyFilter, assertSameTenantOrGlobal } from '../utils/actorContext';

export class PDIController {
    // Crear PDI
    static async create(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            // HIGH-001: scoping por tenant
            const data = { ...req.body, employeeId: req.body.employeeId || user?.employeeId };
            const companyFilter = getActorCompanyFilter(user);
            if (companyFilter) {
                data.companyId = companyFilter;
            }
            const pdi = await PDIService.createPDI(data);
            res.status(201).json(pdi);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    // Obtener PDI por ID
    static async getById(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const pdi = await PDIService.getPDIById(req.params.id);
            if (!pdi) {
                return res.status(404).json({ error: 'PDI no encontrado' });
            }

            // HIGH-001: tenant check
            const pdiCompanyId = (pdi as any).employee?.companyId ?? null;
            if (!isGlobalAdmin(user) && !assertSameTenantOrGlobal(user, pdiCompanyId)) {
                return res.status(404).json({ error: 'PDI no encontrado' });
            }

            // Authorization check
            const isOwner = user?.employeeId === pdi.employeeId;
            const isStaff = isGlobalAdmin(user) || user?.role === 'hr';

            if (!isOwner && !isStaff) {
                return res.status(403).json({ error: 'No tienes permiso para ver este PDI' });
            }

            res.json(pdi);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    // Listar PDIs
    static async list(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const filters: any = {};

            // HIGH-001: scoping por tenant
            const companyFilter = getActorCompanyFilter(user);
            if (companyFilter) {
                filters.employee = { companyId: companyFilter };
                if (user?.role === 'employee') {
                    filters.OR = [{ employeeId: user.employeeId ?? null }];
                }
            } else if (isGlobalAdmin(user)) {
                if (req.query.employeeId) filters.employeeId = req.query.employeeId as string;
            } else {
                return res.status(403).json({ error: 'No autorizado' });
            }

            if (req.query.status) filters.status = req.query.status as string;

            const pdis = await PDIService.listPDIs(filters);
            res.json(pdis);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    // Actualizar PDI
    static async update(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const pdi = await PDIService.getPDIById(req.params.id);
            
            if (!pdi) {
                return res.status(404).json({ error: 'PDI no encontrado' });
            }
            
            // Only owner or admin can update
            if (user?.employeeId !== pdi.employeeId && user?.role !== 'admin') {
                return res.status(403).json({ error: 'No tienes permiso para modificar este PDI' });
            }
            
            const result = await PDIService.updatePDI(req.params.id, req.body);
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    // Activar PDI
    static async activate(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const pdi = await PDIService.activatePDI(req.params.id, user?.id);
            res.json(pdi);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    // Completar PDI
    static async complete(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const pdi = await PDIService.getPDIById(req.params.id);
            
            if (!pdi) {
                return res.status(404).json({ error: 'PDI no encontrado' });
            }
            
            // Only owner or admin can complete
            if (user?.employeeId !== pdi.employeeId && user?.role !== 'admin') {
                return res.status(403).json({ error: 'No tienes permiso para completar este PDI' });
            }
            
            const result = await PDIService.completePDI(req.params.id);
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    // Obtener PDI activo
    static async getActive(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const employeeId = req.params.employeeId;
            
            // Users can only see their own active PDI (unless admin)
            if (user?.employeeId !== employeeId && user?.role !== 'admin') {
                return res.status(403).json({ error: 'No tienes permiso para ver este PDI' });
            }
            
            const pdi = await PDIService.getActivePDI(employeeId);
            res.json(pdi);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
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
                
            const stats = await PDIService.getPDIStats(employeeId);
            res.json(stats);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    // Agregar entrenamiento
    static async addTraining(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const pdi = await PDIService.getPDIById(req.params.id);
            
            if (!pdi) {
                return res.status(404).json({ error: 'PDI no encontrado' });
            }
            
            // Only owner or admin can add training
            if (user?.employeeId !== pdi.employeeId && user?.role !== 'admin') {
                return res.status(403).json({ error: 'No tienes permiso para modificar este PDI' });
            }
            
            const result = await PDIService.addTraining(req.params.id, req.body);
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    // Actualizar estado de entrenamiento
    static async updateTrainingStatus(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const pdi = await PDIService.getPDIById(req.params.id);
            
            if (!pdi) {
                return res.status(404).json({ error: 'PDI no encontrado' });
            }
            
            // Only owner or admin can update training status
            if (user?.employeeId !== pdi.employeeId && user?.role !== 'admin') {
                return res.status(403).json({ error: 'No tienes permiso para modificar este PDI' });
            }
            
            const { trainingId, status } = req.body;
            const result = await PDIService.updateTrainingStatus(
                req.params.id,
                trainingId,
                status
            );
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }
}