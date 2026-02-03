import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';

export const TimeEntryController = {
    getStatus: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            if (!user.employeeId) {
                return ApiResponse.error(res, 'Usuario no vinculado a un empleado', 400);
            }

            // Get the last entry for this employee
            const lastEntry = await prisma.timeEntry.findFirst({
                where: { employeeId: user.employeeId },
                orderBy: { timestamp: 'desc' },
            });

            // Determine status based on last entry type
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
            console.error('Error getting status:', error);
            return ApiResponse.error(res, 'Error al obtener estado', 500);
        }
    },

    clock: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            const { type, latitude, longitude, location, device } = req.body;

            if (!user.employeeId) {
                return ApiResponse.error(res, 'Usuario no vinculado a un empleado', 400);
            }

            if (!['IN', 'OUT', 'BREAK_START', 'BREAK_END', 'LUNCH_START', 'LUNCH_END'].includes(type)) {
                return ApiResponse.error(res, 'Tipo de fichaje inválido', 400);
            }

            // Geofencing Check
            if (latitude && longitude && (type === 'IN' || type === 'OUT')) {
                const employee = await prisma.employee.findUnique({
                    where: { id: user.employeeId },
                    include: { company: true }
                });

                if (employee?.company?.officeLatitude && employee?.company?.officeLongitude) {
                    const distance = getDistanceFromLatLonInM(
                        latitude, longitude,
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
                            console.error('Error creating geofence alert:', alertError);
                        }
                    }
                }
            }

            // Create entry
            const entry = await prisma.timeEntry.create({
                data: {
                    employeeId: user.employeeId,
                    type,
                    latitude,
                    longitude,
                    location,
                    device
                }
            });

            return ApiResponse.success(res, entry);
        } catch (error: any) {
            console.error('Error clocking:', error);
            return ApiResponse.error(res, 'Error al registrar fichaje', 500);
        }
    },

    getHistory: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            if (!user.employeeId) return ApiResponse.error(res, 'No vinculado', 400);

            const { start, end, from, to } = req.query;
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
                orderBy: { timestamp: 'desc' }
            });

            return ApiResponse.success(res, history);
        } catch (error) {
            return ApiResponse.error(res, 'Error al obtener historial', 500);
        }
    }
};

function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // in metres
    return d;
}
