import { Request, Response } from 'express';
import { PDIService } from '../services/PDIService';
import { AuthenticatedRequest } from '../types/express';

export class PDIController {
    // Crear PDI
    static async create(req: Request, res: Response) {
        try {
            const user = (req as AuthenticatedRequest).user;
            const pdi = await PDIService.createPDI({
                ...req.body,
                employeeId: req.body.employeeId || user?.employeeId
            });
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
            
            // Authorization check
            const isOwner = user?.employeeId === pdi.employeeId;
            const isAdmin = user?.role === 'admin';
            
            if (!isOwner && !isAdmin) {
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
            
            // Non-admin users can only see their own PDIs
            if (user?.role !== 'admin') {
                filters.employeeId = user?.employeeId;
            } else if (req.query.employeeId) {
                filters.employeeId = req.query.employeeId as string;
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