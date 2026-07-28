import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
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
            let where: Prisma.CompanyWhereInput = {};

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
                    officeLatitude: officeLatitude ?? null,
                    officeLongitude: officeLongitude ?? null,
                    allowedRadius: allowedRadius ?? 100
                }
            });
            await AuditService.log('CREATE', 'COMPANY', company.id, { name }, user.id);
            return ApiResponse.success(res, company, 'Empresa creada correctamente', 201);
        } catch (error) {
            const duplicateCif = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
            const message = duplicateCif
                ? 'Ya existe una empresa con ese CIF/NIF'
                : error instanceof Error ? error.message : 'Error al crear la empresa';
            const status = duplicateCif ? 409 : error instanceof AppError ? error.statusCode : 500;
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
                    officeLatitude,
                    officeLongitude,
                    allowedRadius
                }
            });
            await AuditService.log('UPDATE', 'COMPANY', id, { name, cif }, user.id);
            return ApiResponse.success(res, company, 'Empresa actualizada correctamente');
        } catch (error) {
            const duplicateCif = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
            const message = duplicateCif
                ? 'Ya existe una empresa con ese CIF/NIF'
                : error instanceof Error ? error.message : 'Error al actualizar la empresa';
            const status = duplicateCif ? 409 : error instanceof AppError ? error.statusCode : 500;
            return ApiResponse.error(res, message, status);
        }
    },

    delete: async (req: Request, res: Response) => {
        const { user } = req as AuthenticatedRequest;
        try {
            if (!isGlobalAdmin(user)) {
                throw new AppError('Solo un administrador global puede eliminar empresas', 403);
            }

            const company = await prisma.company.findUnique({
                where: { id: req.params.id },
                select: {
                    id: true,
                    _count: {
                        select: {
                            employees: true,
                            onboardingTemplates: true,
                            documentTemplates: true,
                            vehicles: true,
                            cards: true,
                            fileMappings: true,
                            calendarEvents: true,
                            payrollControlPeriods: true,
                            payrollControlConceptConfigs: true,
                            employmentPeriods: true,
                        },
                    },
                },
            });

            if (!company) {
                throw new AppError('Empresa no encontrada', 404);
            }

            const relatedRecords = Object.values(company._count).reduce((total, count) => total + count, 0);
            if (relatedRecords > 0) {
                throw new AppError(
                    'No se puede eliminar una empresa con empleados, periodos o datos históricos asociados',
                    409
                );
            }

            await prisma.company.delete({ where: { id: company.id } });
            await AuditService.log('DELETE', 'COMPANY', req.params.id, undefined, user.id);
            return ApiResponse.success(res, null, 'Empresa eliminada');
        } catch (error) {
            const relationConflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
            const message = relationConflict
                ? 'No se puede eliminar una empresa con datos asociados'
                : error instanceof Error ? error.message : 'Error al eliminar la empresa';
            const status = relationConflict ? 409 : error instanceof AppError ? error.statusCode : 500;
            return ApiResponse.error(res, message, status);
        }
    }
};

