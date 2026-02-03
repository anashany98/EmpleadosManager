import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export class EmployeeProjectWorkController {
    async getByEmployee(req: Request, res: Response) {
        try {
            const { employeeId } = req.params;
            const entries = await prisma.employeeProjectWork.findMany({
                where: { employeeId },
                include: { project: true },
                orderBy: { startDate: 'desc' }
            });
            res.json(entries);
        } catch (error: any) {
            res.status(500).json({ error: 'Failed to fetch project work entries', details: error.message });
        }
    }

    async create(req: Request, res: Response) {
        try {
            const { employeeId, projectId, startDate, endDate, hours, notes } = req.body;
            const entry = await prisma.employeeProjectWork.create({
                data: {
                    employeeId,
                    projectId,
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    hours: parseFloat(hours),
                    notes
                },
                include: { project: true }
            });
            res.status(201).json(entry);
        } catch (error: any) {
            res.status(500).json({ error: 'Failed to create work entry', details: error.message });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await prisma.employeeProjectWork.delete({
                where: { id }
            });
            res.status(204).send();
        } catch (error: any) {
            res.status(500).json({ error: 'Failed to delete work entry', details: error.message });
        }
    }
}

export const employeeProjectWorkController = new EmployeeProjectWorkController();
