import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export class ProjectController {
    async getAll(req: Request, res: Response) {
        try {
            const projects = await prisma.project.findMany({
                where: { active: true },
                orderBy: { createdAt: 'desc' }
            });
            res.json(projects);
        } catch (error: any) {
            res.status(500).json({ error: 'Failed to fetch projects', details: error.message });
        }
    }

    async create(req: Request, res: Response) {
        try {
            const { name, code, destination } = req.body;
            const project = await prisma.project.create({
                data: { name, code, destination }
            });
            res.status(201).json(project);
        } catch (error: any) {
            res.status(500).json({ error: 'Failed to create project', details: error.message });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await prisma.project.update({
                where: { id },
                data: { active: false }
            });
            res.status(204).send();
        } catch (error: any) {
            res.status(500).json({ error: 'Failed to delete project', details: error.message });
        }
    }
}

export const projectController = new ProjectController();
