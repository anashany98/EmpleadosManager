import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuditService } from '../services/AuditService';
import { AuthenticatedRequest } from '../types/express';
import { ApiResponse } from '../utils/ApiResponse';
import { assertCompanyAccess, isGlobalAdmin } from '../utils/companyAccess';
import { AppError } from '../utils/AppError';

export const CompanyController = {
    getAll: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { user } = req as AuthenticatedRequest;
            let where: any = {};

            if (!isGlobalAdmin(user)) {
                if (!user.companyId) {
                    throw new AppError('Usuario sin empresa asignada', 403);
                }

                where = { id: user.companyId };
            }

            const companies = await prisma.company.findMany({
                where,
                orderBy: { name: 'asc' }
            });
            return ApiResponse.success(res, companies);
        } catch (error) {
            next(error);
        }
    },

    create: async (req: Request, res: Response) => {
        const { user } = req as AuthenticatedRequest;
        const { name, cif, logoUrl, legalRep, address, postalCode, city, province, country, email, phone, officeLatitude, officeLongitude, allowedRadius } = req.body;
        try {
            if (!isGlobalAdmin(user)) {
                throw new AppError('Solo un administrador global puede crear empresas', 403);
            }

            const company = await prisma.company.create({
                data: {
                    name, cif, logoUrl,
                    legalRep, address, postalCode, city, province, country, email, phone,
                    officeLatitude: officeLatitude ? parseFloat(officeLatitude) : null,
                    officeLongitude: officeLongitude ? parseFloat(officeLongitude) : null,
                    allowedRadius: allowedRadius ? parseInt(allowedRadius) : 100
                }
            });
            await AuditService.log('CREATE', 'COMPANY', company.id, { name }, user.id);
            return ApiResponse.success(res, company, 'Empresa creada correctamente', 201);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error al crear la empresa';
            const status = error instanceof AppError ? error.statusCode : 500;
            return ApiResponse.error(res, message, status);
        }
    },

    update: async (req: Request, res: Response) => {
        const { user } = req as AuthenticatedRequest;
        const { id } = req.params;
        const { name, cif, logoUrl, legalRep, address, postalCode, city, province, country, email, phone, officeLatitude, officeLongitude, allowedRadius } = req.body;
        try {
            const existing = await prisma.company.findUnique({ where: { id }, select: { id: true } });
            if (!existing) {
                throw new AppError('Empresa no encontrada', 404);
            }

            if (!isGlobalAdmin(user)) {
                assertCompanyAccess(user, existing.id, 'No puedes modificar otra empresa');
            }

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
            await AuditService.log('UPDATE', 'COMPANY', id, { name, cif }, user.id);
            return ApiResponse.success(res, company, 'Empresa actualizada correctamente');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error al actualizar la empresa';
            const status = error instanceof AppError ? error.statusCode : 500;
            return ApiResponse.error(res, message, status);
        }
    },

    delete: async (req: Request, res: Response) => {
        const { user } = req as AuthenticatedRequest;
        try {
            if (!isGlobalAdmin(user)) {
                throw new AppError('Solo un administrador global puede eliminar empresas', 403);
            }

            await prisma.company.delete({ where: { id: req.params.id } });
            await AuditService.log('DELETE', 'COMPANY', req.params.id, undefined, user.id);
            return ApiResponse.success(res, null, 'Empresa eliminada');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error al eliminar la empresa';
            const status = error instanceof AppError ? error.statusCode : 500;
            return ApiResponse.error(res, message, status);
        }
    }
};

