import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../types/express';
import { canManageEmployee, canReadEmployeeDetail } from '../policies/employeeAccess';

export const ChecklistController = {
    getByEmployee: async (req: Request, res: Response) => {
        const { employeeId } = req.params;
        const { type } = req.query;
        try {
            const { user } = req as AuthenticatedRequest;
            const employee = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { id: true, companyId: true }
            });

            if (!employee) {
                throw new AppError('Empleado no encontrado', 404);
            }

            if (!canReadEmployeeDetail(user, employee)) {
                throw new AppError('No autorizado', 403);
            }

            const tasks = await prisma.checklistTask.findMany({
                where: {
                    employeeId,
                    type: type ? String(type) : undefined
                },
                orderBy: { createdAt: 'asc' }
            });
            return ApiResponse.success(res, tasks);
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError('Error al obtener tareas', 500);
        }
    },

    createTask: async (req: Request, res: Response) => {
        const { employeeId, type, title, description, deadline } = req.body;
        try {
            const { user } = req as AuthenticatedRequest;
            const employee = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { id: true, companyId: true }
            });

            if (!employee) {
                throw new AppError('Empleado no encontrado', 404);
            }

            if (!canManageEmployee(user, employee)) {
                throw new AppError('No autorizado', 403);
            }

            const task = await prisma.checklistTask.create({
                data: {
                    employeeId,
                    type,
                    title,
                    description,
                    deadline: deadline ? new Date(deadline) : null
                }
            });
            return ApiResponse.success(res, task, 'Tarea creada');
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError('Error al crear tarea', 500);
        }
    },

    toggleTask: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { completed } = req.body;
        try {
            const { user } = req as AuthenticatedRequest;
            const existing = await prisma.checklistTask.findUnique({
                where: { id },
                include: {
                    employee: {
                        select: {
                            id: true,
                            companyId: true
                        }
                    }
                }
            });

            if (!existing) {
                throw new AppError('Tarea no encontrada', 404);
            }

            if (!canManageEmployee(user, existing.employee)) {
                throw new AppError('No autorizado', 403);
            }

            const task = await prisma.checklistTask.update({
                where: { id },
                data: {
                    completed,
                    completedAt: completed ? new Date() : null
                }
            });
            return ApiResponse.success(res, task);
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError('Error al actualizar tarea', 500);
        }
    },

    deleteTask: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const { user } = req as AuthenticatedRequest;
            const existing = await prisma.checklistTask.findUnique({
                where: { id },
                include: {
                    employee: {
                        select: {
                            id: true,
                            companyId: true
                        }
                    }
                }
            });

            if (!existing) {
                throw new AppError('Tarea no encontrada', 404);
            }

            if (!canManageEmployee(user, existing.employee)) {
                throw new AppError('No autorizado', 403);
            }

            await prisma.checklistTask.delete({ where: { id } });
            return ApiResponse.success(res, null, 'Tarea eliminada');
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError('Error al eliminar tarea', 500);
        }
    }
};
