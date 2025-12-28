import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';

export const ChecklistController = {
    getByEmployee: async (req: Request, res: Response) => {
        const { employeeId } = req.params;
        const { type } = req.query;
        try {
            const tasks = await prisma.checklistTask.findMany({
                where: {
                    employeeId,
                    type: type ? String(type) : undefined
                },
                orderBy: { createdAt: 'asc' }
            });
            return ApiResponse.success(res, tasks);
        } catch (error) {
            throw new AppError('Error al obtener tareas', 500);
        }
    },

    createTask: async (req: Request, res: Response) => {
        const { employeeId, type, title, description, deadline } = req.body;
        try {
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
            throw new AppError('Error al crear tarea', 500);
        }
    },

    toggleTask: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { completed } = req.body;
        try {
            const task = await prisma.checklistTask.update({
                where: { id },
                data: {
                    completed,
                    completedAt: completed ? new Date() : null
                }
            });
            return ApiResponse.success(res, task);
        } catch (error) {
            throw new AppError('Error al actualizar tarea', 500);
        }
    },

    deleteTask: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            await prisma.checklistTask.delete({ where: { id } });
            return ApiResponse.success(res, null, 'Tarea eliminada');
        } catch (error) {
            throw new AppError('Error al eliminar tarea', 500);
        }
    }
};
