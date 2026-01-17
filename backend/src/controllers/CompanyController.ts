import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuditService } from '../services/AuditService';

export const CompanyController = {
    getAll: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const companies = await prisma.company.findMany({
                orderBy: { name: 'asc' }
            });
            res.json(companies);
        } catch (error) {
            next(error);
        }
    },

    create: async (req: Request, res: Response) => {
        const { name, cif, logoUrl, legalRep, address, postalCode, city, province, country, email, phone, officeLatitude, officeLongitude, allowedRadius } = req.body;
        try {
            const company = await prisma.company.create({
                data: {
                    name, cif, logoUrl,
                    legalRep, address, postalCode, city, province, country, email, phone,
                    officeLatitude: officeLatitude ? parseFloat(officeLatitude) : null,
                    officeLongitude: officeLongitude ? parseFloat(officeLongitude) : null,
                    allowedRadius: allowedRadius ? parseInt(allowedRadius) : 100
                }
            });
            await AuditService.log('CREATE', 'COMPANY', company.id, { name });
            res.status(201).json(company);
        } catch (error) {
            res.status(500).json({ error: 'Error al crear la empresa' });
        }
    },

    update: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { name, cif, logoUrl, legalRep, address, postalCode, city, province, country, email, phone, officeLatitude, officeLongitude, allowedRadius } = req.body;
        try {
            const company = await prisma.company.update({
                where: { id },
                data: {
                    name, cif, logoUrl,
                    legalRep, address, postalCode, city, province, country, email, phone,
                    officeLatitude: officeLatitude ? parseFloat(officeLatitude) : null,
                    officeLongitude: officeLongitude ? parseFloat(officeLongitude) : null,
                    allowedRadius: allowedRadius ? parseInt(allowedRadius) : 100
                }
            });
            await AuditService.log('UPDATE', 'COMPANY', id, { name, cif });
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
