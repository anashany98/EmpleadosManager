import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../services/AuditService';

const prisma = new PrismaClient();

export const CompanyController = {
    getAll: async (req: Request, res: Response) => {
        try {
            const companies = await prisma.company.findMany({
                orderBy: { name: 'asc' }
            });
            res.json(companies);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener empresas' });
        }
    },

    create: async (req: Request, res: Response) => {
        const { name, cif, logoUrl } = req.body;
        try {
            const company = await prisma.company.create({
                data: { name, cif }
            });
            await AuditService.log('CREATE', 'COMPANY', company.id, { name });
            res.status(201).json(company);
        } catch (error) {
            res.status(500).json({ error: 'Error al crear la empresa' });
        }
    },

    update: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { name, cif, logoUrl } = req.body;
        try {
            const company = await prisma.company.update({
                where: { id },
                data: { name, cif, logoUrl }
            });
            await AuditService.log('UPDATE', 'COMPANY', id, { name, cif, logoUrl });
            res.json(company);
        } catch (error) {
            res.status(500).json({ error: 'Error al actualizar la empresa' });
        }
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            await prisma.company.delete({ where: { id: req.params.id } });
            await AuditService.log('DELETE', 'COMPANY', req.params.id);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar la empresa' });
        }
    }
};
