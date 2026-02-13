import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AnomalyService } from '../services/AnomalyService';
import { AuditService } from '../services/AuditService';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';

const log = createLogger('TimeEntryController');

const parseTimestamp = (value: any) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const now = Date.now();
    const maxPastMs = 24 * 60 * 60 * 1000;
    const maxFutureMs = 5 * 60 * 1000;
    if (date.getTime() > now + maxFutureMs) return null;
    if (now - date.getTime() > maxPastMs) return null;
    return date;
};

export const TimeEntryController = {
    getStatus: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            if (!user.employeeId) {
                return ApiResponse.error(res, 'Usuario no vinculado a un empleado', 400);
            }

            const lastEntry = await prisma.timeEntry.findFirst({
                where: { employeeId: user.employeeId },
                orderBy: { timestamp: 'desc' },
            });

            let status = 'OFF';
            if (lastEntry) {
                switch (lastEntry.type) {
                    case 'IN':
                    case 'BREAK_END':
                    case 'LUNCH_END':
                        status = 'WORKING';
                        break;
                    case 'BREAK_START':
                        status = 'BREAK';
                        break;
                    case 'LUNCH_START':
                        status = 'LUNCH';
                        break;
                    case 'OUT':
                        status = 'OFF';
                        break;
                }
            }

            return ApiResponse.success(res, { status, lastEntry });
        } catch (error: any) {
            log.error({ error }, 'Error getting status');
            return ApiResponse.error(res, 'Error al obtener estado', 500);
        }
    },

    clock: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { type, latitude, longitude, location, device, timestamp } = req.body;

            if (!user.employeeId) {
                return ApiResponse.error(res, 'Usuario no vinculado a un empleado', 400);
            }

            if (!['IN', 'OUT', 'BREAK_START', 'BREAK_END', 'LUNCH_START', 'LUNCH_END'].includes(type)) {
                return ApiResponse.error(res, 'Tipo de fichaje inválido', 400);
            }

            const parsedTimestamp = parseTimestamp(timestamp);
            const lat = latitude !== null && latitude !== undefined ? Number(latitude) : null;
            const lon = longitude !== null && longitude !== undefined ? Number(longitude) : null;
            const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);

            // Geofencing Check
            if (hasCoords && (type === 'IN' || type === 'OUT')) {
                const employee = await prisma.employee.findUnique({
                    where: { id: user.employeeId },
                    include: { company: true }
                });

                if (employee?.company?.officeLatitude && employee?.company?.officeLongitude) {
                    const distance = getDistanceFromLatLonInM(
                        lat as number, lon as number,
                        employee.company.officeLatitude,
                        employee.company.officeLongitude
                    );

                    const radius = employee.company.allowedRadius || 100;

                    if (distance > radius) {
                        try {
                            await prisma.alert.create({
                                data: {
                                    employeeId: user.employeeId,
                                    type: 'GEOFENCE',
                                    severity: 'WARNING',
                                    title: 'Fichaje fuera de zona',
                                    message: `Fichaje ${type} realizado a ${Math.round(distance)}m de la oficina (Radio: ${radius}m). Ubicación: ${location || 'Desconocida'}`,
                                    isRead: false
                                }
                            });
                        } catch (alertError) {
                            log.error({ alertError }, 'Error creating geofence alert');
                        }
                    }
                }
            }

            const entry = await prisma.timeEntry.create({
                data: {
                    employeeId: user.employeeId,
                    type,
                    latitude: hasCoords ? (lat as number) : null,
                    longitude: hasCoords ? (lon as number) : null,
                    location,
                    device,
                    ...(parsedTimestamp ? { timestamp: parsedTimestamp } : {})
                }
            });

            AnomalyService.detectTimeEntry(entry).catch(err => log.error({ err }, 'Anomaly detection failed'));

            return ApiResponse.success(res, entry);
        } catch (error: any) {
            log.error({ error }, 'Error clocking');
            return ApiResponse.error(res, 'Error al registrar fichaje', 500);
        }
    },

    getHistory: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            if (!user.employeeId) return ApiResponse.error(res, 'No vinculado', 400);

            const { start, end, from, to } = req.query;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const skip = (page - 1) * limit;
            const startDate = start || from;
            const endDate = end || to;
            let query: any = { employeeId: user.employeeId };

            if (start && end) {
                query.timestamp = {
                    gte: new Date(start as string),
                    lte: new Date(end as string)
                };
            }

            const history = await prisma.timeEntry.findMany({
                where: query,
                orderBy: { timestamp: 'desc' },
                skip: req.query.page ? skip : undefined,
                take: req.query.page ? limit : 500
            });

            return ApiResponse.success(res, history);
        } catch (error) {
            return ApiResponse.error(res, 'Error al obtener historial', 500);
        }
    },

    createManual: async (req: Request, res: Response) => {
        try {
            const { employeeId, type, timestamp, location, comment } = req.body;
            const currentUser = (req as AuthenticatedRequest).user;
            const adminId = currentUser?.id || 'system';

            if (!employeeId || !type || !timestamp) {
                return ApiResponse.error(res, 'Faltan campos obligatorios', 400);
            }

            // Security: Verify target employee belongs to admin's company
            if (currentUser && currentUser.role === 'admin' && currentUser.companyId) {
                const target = await prisma.employee.findUnique({
                    where: { id: employeeId },
                    select: { companyId: true }
                });

                if (!target || target.companyId !== currentUser.companyId) {
                    return ApiResponse.error(res, 'No autorizado para gestionar empleados de otra empresa', 403);
                }
            }

            const entry = await prisma.timeEntry.create({
                data: {
                    employeeId,
                    type,
                    timestamp: new Date(timestamp),
                    location: location || 'Corrección Admin',
                    device: `Admin Fix (${adminId})`,
                }
            });

            await AuditService.log('MANUAL_CLOCK', 'TIME_ENTRY', entry.id, {
                employeeId,
                type,
                timestamp,
                comment
            }, adminId);

            return ApiResponse.success(res, entry, 'Fichaje manual creado correctamente');
        } catch (error: any) {
            log.error({ error }, 'Error in createManual');
            return ApiResponse.error(res, 'Error al crear fichaje manual', 500);
        }
    }
};

function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // in metres
    return d;
}
