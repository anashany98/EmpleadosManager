import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthenticatedRequest } from '../types/express';
import { AppError } from '../utils/AppError';
import { assertCompanyAccess, isGlobalAdmin } from '../utils/companyAccess';
import { AuditService } from '../services/AuditService';

function cleanText(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function optionalText(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    const cleaned = cleanText(value);
    return cleaned || null;
}

function parseOptionalInt(value: unknown): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const parsed = Number.parseInt(String(value), 10);
    if (Number.isNaN(parsed)) {
        throw new AppError('Hay campos numéricos con formato no válido.', 400);
    }
    return parsed;
}

function parseOptionalFloat(value: unknown): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const normalized = String(value).replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    if (Number.isNaN(parsed)) {
        throw new AppError('Hay importes con formato no válido.', 400);
    }
    return parsed;
}

function parseOptionalDate(value: unknown): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) {
        throw new AppError('Hay fechas con formato no válido.', 400);
    }
    return parsed;
}

function normalizePlate(value: unknown): string {
    return cleanText(value).toUpperCase().replace(/\s+/g, '');
}

function getTargetCompanyId(vehicle: {
    companyId?: string | null;
    employee?: { companyId?: string | null } | null;
}) {
    return vehicle.companyId || vehicle.employee?.companyId || null;
}

async function ensureVehicleAccess(user: AuthenticatedRequest['user'], vehicleId: string) {
    const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        include: {
            employee: { select: { companyId: true } },
            company: { select: { id: true } }
        }
    });

    if (!vehicle) {
        throw new AppError('Vehículo no encontrado', 404);
    }

    if (!isGlobalAdmin(user)) {
        assertCompanyAccess(user, getTargetCompanyId(vehicle), 'No autorizado para gestionar vehículos de otra empresa');
    }

    return vehicle;
}

async function resolveEmployeeCompanyId(employeeId: string | null | undefined) {
    if (!employeeId) return null;

    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { companyId: true }
    });

    if (!employee) {
        throw new AppError('Empleado no encontrado', 404);
    }

    return employee.companyId || null;
}

function buildVehiclePayload(body: Record<string, unknown>) {
    const plate = normalizePlate(body.plate);
    const make = cleanText(body.make);
    const model = cleanText(body.model);

    if (!plate || !make || !model) {
        throw new AppError('Matrícula, marca y modelo son obligatorios.', 400);
    }

    return {
        plate,
        make,
        model,
        year: parseOptionalInt(body.year),
        vin: optionalText(body.vin),
        type: cleanText(body.type) || 'CAR',
        status: cleanText(body.status) || 'ACTIVE',
        purchaseDate: parseOptionalDate(body.purchaseDate),
        nextITVDate: parseOptionalDate(body.nextITVDate),
        insuranceExpiry: parseOptionalDate(body.insuranceExpiry),
        lastMaintenanceDate: parseOptionalDate(body.lastMaintenanceDate),
        nextMaintenanceKm: parseOptionalInt(body.nextMaintenanceKm),
        currentMileage: parseOptionalInt(body.currentMileage) ?? 0,
        employeeId: optionalText(body.employeeId),
        companyId: optionalText(body.companyId),
        image: optionalText(body.image)
    };
}

function buildVehicleUpdatePayload(body: Record<string, unknown>) {
    const payload: Record<string, unknown> = {};

    if ('plate' in body) {
        const plate = normalizePlate(body.plate);
        if (!plate) throw new AppError('La matrícula no puede estar vacía.', 400);
        payload.plate = plate;
    }

    if ('make' in body) {
        const make = cleanText(body.make);
        if (!make) throw new AppError('La marca no puede estar vacía.', 400);
        payload.make = make;
    }

    if ('model' in body) {
        const model = cleanText(body.model);
        if (!model) throw new AppError('El modelo no puede estar vacío.', 400);
        payload.model = model;
    }

    if ('year' in body) payload.year = parseOptionalInt(body.year);
    if ('vin' in body) payload.vin = optionalText(body.vin);
    if ('type' in body) payload.type = cleanText(body.type) || 'CAR';
    if ('status' in body) payload.status = cleanText(body.status) || 'ACTIVE';
    if ('purchaseDate' in body) payload.purchaseDate = parseOptionalDate(body.purchaseDate);
    if ('nextITVDate' in body) payload.nextITVDate = parseOptionalDate(body.nextITVDate);
    if ('insuranceExpiry' in body) payload.insuranceExpiry = parseOptionalDate(body.insuranceExpiry);
    if ('lastMaintenanceDate' in body) payload.lastMaintenanceDate = parseOptionalDate(body.lastMaintenanceDate);
    if ('nextMaintenanceKm' in body) payload.nextMaintenanceKm = parseOptionalInt(body.nextMaintenanceKm);
    if ('currentMileage' in body) payload.currentMileage = parseOptionalInt(body.currentMileage) ?? 0;
    if ('employeeId' in body) payload.employeeId = optionalText(body.employeeId);
    if ('companyId' in body) payload.companyId = optionalText(body.companyId);
    if ('image' in body) payload.image = optionalText(body.image);

    return payload;
}

function buildVehicleLogPayload(body: Record<string, unknown>) {
    const type = cleanText(body.type);
    const title = cleanText(body.title);

    if (!type || !title) {
        throw new AppError('Tipo y título del registro son obligatorios.', 400);
    }

    return {
        type,
        title,
        description: optionalText(body.description),
        eventDate: parseOptionalDate(body.eventDate) || new Date(),
        mileage: parseOptionalInt(body.mileage),
        cost: parseOptionalFloat(body.cost),
        workshop: optionalText(body.workshop),
        severity: optionalText(body.severity),
        status: optionalText(body.status),
        nextActionDate: parseOptionalDate(body.nextActionDate),
        resolvedAt: parseOptionalDate(body.resolvedAt)
    };
}

function handleControllerError(res: Response, error: unknown, fallback: string) {
    if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return ApiResponse.error(res, 'Ya existe un vehículo con esa matrícula.', 400);
    }

    const message = error instanceof Error ? error.message : fallback;
    return ApiResponse.error(res, message, 500);
}

export const VehicleController = {
    getAll: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            let where: Prisma.VehicleWhereInput = {};

            if (!isGlobalAdmin(user)) {
                if (!user.companyId) {
                    throw new AppError('Usuario sin empresa asignada', 403);
                }

                where = {
                    OR: [
                        { companyId: user.companyId },
                        { employee: { is: { companyId: user.companyId } } }
                    ]
                };
            }

            const vehicles = await prisma.vehicle.findMany({
                where,
                include: {
                    employee: true,
                    company: true,
                    logs: {
                        orderBy: { eventDate: 'desc' },
                        take: 5
                    },
                    documents: { orderBy: { createdAt: 'desc' } },
                    _count: {
                        select: { logs: true }
                    }
                },
                orderBy: { plate: 'asc' }
            });

            return ApiResponse.success(res, vehicles);
        } catch (error) {
            return handleControllerError(res, error, 'Error al obtener vehículos');
        }
    },

    getById: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const vehicle = await prisma.vehicle.findUnique({
                where: { id },
                include: {
                    employee: true,
                    company: true,
                    logs: { orderBy: { eventDate: 'desc' } },
                    documents: { orderBy: { createdAt: 'desc' } }
                }
            });

            if (!vehicle) {
                return ApiResponse.error(res, 'Vehículo no encontrado', 404);
            }

            if (!isGlobalAdmin(user)) {
                assertCompanyAccess(user, getTargetCompanyId(vehicle), 'No autorizado para consultar vehículos de otra empresa');
            }

            return ApiResponse.success(res, vehicle);
        } catch (error) {
            return handleControllerError(res, error, 'Error al obtener vehículo');
        }
    },

    create: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const payload = buildVehiclePayload(req.body);
            const employeeCompanyId = await resolveEmployeeCompanyId(payload.employeeId);

            if (payload.companyId && employeeCompanyId && payload.companyId !== employeeCompanyId) {
                throw new AppError('La empresa del vehículo no coincide con la del empleado asignado.', 400);
            }

            const resolvedCompanyId = employeeCompanyId || payload.companyId || user.companyId || null;

            if (!isGlobalAdmin(user)) {
                if (!resolvedCompanyId) {
                    throw new AppError('Debe indicar una empresa o un empleado de la misma empresa.', 400);
                }

                assertCompanyAccess(user, resolvedCompanyId, 'No autorizado para crear vehículos en otra empresa');
            }

            const vehicle = await prisma.vehicle.create({
                data: {
                    ...payload,
                    companyId: resolvedCompanyId
                },
                include: {
                    employee: true,
                    company: true,
                    logs: { orderBy: { eventDate: 'desc' } }
                }
            });

            await AuditService.log('CREATE', 'VEHICLE', vehicle.id, {
                plate: vehicle.plate,
                companyId: vehicle.companyId,
                employeeId: vehicle.employeeId
            }, user.id);

            return ApiResponse.success(res, vehicle, 'Vehículo creado correctamente');
        } catch (error) {
            return handleControllerError(res, error, 'Error al crear vehículo');
        }
    },

    update: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const existing = await ensureVehicleAccess(user, id);
            const payload = buildVehicleUpdatePayload(req.body);
            const nextEmployeeId = Object.prototype.hasOwnProperty.call(payload, 'employeeId')
                ? payload.employeeId as string | null | undefined
                : existing.employeeId;
            const employeeCompanyId = await resolveEmployeeCompanyId(nextEmployeeId || undefined);
            const requestedCompanyId = Object.prototype.hasOwnProperty.call(payload, 'companyId')
                ? payload.companyId as string | null | undefined
                : existing.companyId;

            if (requestedCompanyId && employeeCompanyId && requestedCompanyId !== employeeCompanyId) {
                throw new AppError('La empresa del vehículo no coincide con la del empleado asignado.', 400);
            }

            const resolvedCompanyId = employeeCompanyId
                || requestedCompanyId
                || existing.companyId
                || user.companyId
                || null;

            if (!isGlobalAdmin(user) && resolvedCompanyId) {
                assertCompanyAccess(user, resolvedCompanyId, 'No autorizado para actualizar vehículos de otra empresa');
            }

            const vehicle = await prisma.vehicle.update({
                where: { id },
                data: {
                    ...payload,
                    companyId: resolvedCompanyId
                },
                include: {
                    employee: true,
                    company: true,
                    logs: { orderBy: { eventDate: 'desc' } }
                }
            });

            await AuditService.log('UPDATE', 'VEHICLE', vehicle.id, {
                plate: vehicle.plate,
                companyId: vehicle.companyId,
                employeeId: vehicle.employeeId
            }, user.id);

            return ApiResponse.success(res, vehicle, 'Vehículo actualizado');
        } catch (error) {
            return handleControllerError(res, error, 'Error al actualizar vehículo');
        }
    },

    getLogs: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            await ensureVehicleAccess(user, id);

            const logs = await prisma.vehicleLog.findMany({
                where: { vehicleId: id },
                orderBy: { createdAt: 'desc' },
                take: 100
            });

            return ApiResponse.success(res, logs);
        } catch (error) {
            return handleControllerError(res, error, 'Error al obtener los registros del vehículo');
        }
    },

    createLog: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            await ensureVehicleAccess(user, id);
            const payload = buildVehicleLogPayload(req.body);

            const log = await prisma.vehicleLog.create({
                data: {
                    vehicleId: id,
                    ...payload
                }
            });

            await AuditService.log('CREATE', 'VEHICLE', id, {
                info: 'Vehicle log created',
                logType: log.type,
                title: log.title
            }, user.id);

            return ApiResponse.success(res, log, 'Registro del vehículo añadido correctamente');
        } catch (error) {
            return handleControllerError(res, error, 'Error al guardar el registro del vehículo');
        }
    },

    deleteLog: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id, logId } = req.params;
            await ensureVehicleAccess(user, id);
            const existingLog = await prisma.vehicleLog.findUnique({ where: { id: logId } });

            if (!existingLog || existingLog.vehicleId !== id) {
                throw new AppError('Registro del vehículo no encontrado.', 404);
            }

            await prisma.vehicleLog.delete({ where: { id: logId } });
            await AuditService.log('DELETE', 'VEHICLE', id, {
                info: 'Vehicle log deleted',
                logType: existingLog.type,
                title: existingLog.title
            }, user.id);

            return ApiResponse.success(res, null, 'Registro del vehículo eliminado');
        } catch (error) {
            return handleControllerError(res, error, 'Error al eliminar el registro del vehículo');
        }
    },

    delete: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const existing = await ensureVehicleAccess(user, id);

            const vehicle = await prisma.vehicle.update({
                where: { id },
                data: { status: 'INACTIVE' }
            });
            await AuditService.log('UPDATE', 'VEHICLE', id, {
                plate: existing.plate,
                status: vehicle.status,
                info: 'Vehicle deactivated'
            }, user.id);
            return ApiResponse.success(res, vehicle, 'Vehiculo dado de baja');
        } catch (error) {
            return handleControllerError(res, error, 'Error al eliminar vehículo');
        }
    },

    downloadDocument: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id, docId } = req.params;

            await ensureVehicleAccess(user, id);

            const existing = await prisma.vehicleDocument.findUnique({ where: { id: docId } });
            if (!existing || existing.vehicleId !== id) {
                throw new AppError('Documento no encontrado', 404);
            }

            const documentsDir = path.resolve(process.cwd(), 'uploads', 'vehicle-documents');
            const fileName = path.basename(existing.fileUrl);
            const filePath = path.resolve(documentsDir, fileName);

            if (!filePath.startsWith(`${documentsDir}${path.sep}`) || !fs.existsSync(filePath)) {
                throw new AppError('Archivo no encontrado', 404);
            }

            res.setHeader('Content-Disposition', `attachment; filename="${path.basename(existing.name)}"`);
            return res.sendFile(filePath);
        } catch (error) {
            return handleControllerError(res, error, 'Error al descargar documento');
        }
    },

    uploadDocument: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const { type, name, expiryDate } = req.body;

            await ensureVehicleAccess(user, id);

            if (!req.file) {
                throw new AppError('No se ha subido ningún archivo', 400);
            }

            const validTypes = ['INSURANCE', 'REGISTRATION', 'ITV', 'INVOICE', 'OTHER'];
            if (!type || !validTypes.includes(type)) {
                throw new AppError('Tipo de documento inválido. Debe ser: INSURANCE, REGISTRATION, ITV, INVOICE u OTHER', 400);
            }

            const doc = await prisma.vehicleDocument.create({
                data: {
                    vehicleId: id,
                    type,
                    name: name || req.file.originalname,
                    fileUrl: `/uploads/vehicle-documents/${req.file.filename}`,
                    expiryDate: parseOptionalDate(expiryDate)
                }
            });

            await AuditService.log('CREATE', 'VEHICLE_DOCUMENT', id, {
                docType: type,
                name: doc.name
            }, user.id);

            return ApiResponse.success(res, doc, 'Documento subido correctamente', 201);
        } catch (error) {
            return handleControllerError(res, error, 'Error al subir documento');
        }
    },

    deleteDocument: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id, docId } = req.params;

            await ensureVehicleAccess(user, id);

            const existing = await prisma.vehicleDocument.findUnique({ where: { id: docId } });
            if (!existing || existing.vehicleId !== id) {
                throw new AppError('Documento no encontrado', 404);
            }

            await prisma.vehicleDocument.delete({ where: { id: docId } });
            await AuditService.log('DELETE', 'VEHICLE_DOCUMENT', id, {
                docType: existing.type,
                name: existing.name
            }, user.id);

            return ApiResponse.success(res, null, 'Documento eliminado');
        } catch (error) {
            return handleControllerError(res, error, 'Error al eliminar documento');
        }
    }
};
