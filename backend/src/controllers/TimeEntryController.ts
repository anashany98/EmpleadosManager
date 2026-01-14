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
