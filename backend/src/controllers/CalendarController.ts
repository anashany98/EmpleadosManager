
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../types/express';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { CalendarService } from '../services/CalendarService';

const SECRET = process.env.JWT_SECRET || 'secret-calendar-key';

export const CalendarController = {
    getSubscriptionLink: async (req: Request, res: Response) => {
        const { user } = req as AuthenticatedRequest;
        if (!user || !user.id) return ApiResponse.error(res, 'Usuario no identificado', 401);

        // Find employee associated with user email
        const employee = await prisma.employee.findFirst({
            where: { email: user.email },
            select: { id: true }
        });

        if (!employee) return ApiResponse.error(res, 'No tienes un perfil de empleado asociado', 404);

        // Generate HMAC signature
        const signature = crypto.createHmac('sha256', SECRET)
            .update(employee.id)
            .digest('hex');

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const backendUrl = process.env.VITE_API_URL || 'http://localhost:3000'; // Or construct from req

        // We return the full feed URL
        // If frontend talks to backend via /api, the feed is at /api/calendar/feed
        // The user needs an absolute URL to put in Google Calendar.

        // Construct URL assuming typical deployment
        const feedUrl = `${backendUrl}/api/calendar/feed?u=${employee.id}&s=${signature}`;

        return ApiResponse.success(res, { url: feedUrl });
    },

    getFeed: async (req: Request, res: Response) => {
        const { u: employeeId, s: signature } = req.query;

        if (!employeeId || !signature) {
            return res.status(400).send('Missing parameters');
        }

        // Verify signature
        const expected = crypto.createHmac('sha256', SECRET)
            .update(employeeId as string)
            .digest('hex');

        if (signature !== expected) {
            return res.status(403).send('Invalid signature');
        }

        try {
            const employee = await prisma.employee.findUnique({
                where: { id: employeeId as string }
            });

            if (!employee) return res.status(404).send('Employee not found');

            const vacations = await prisma.vacation.findMany({
                where: {
                    employeeId: employeeId as string,
                    status: 'APPROVED' // Only approved ones? Or pending too? Usually Approved.
                },
                orderBy: { startDate: 'desc' }
            });

            // Fetch Vehicles (If admin -> all, else -> assigned)
            const user = await prisma.user.findFirst({ where: { employeeId: employeeId as string } });
            const isAdmin = user?.role === 'admin';

            // @ts-ignore: Prisma client not regenerated
            const vehicles = await prisma.vehicle.findMany({
                where: isAdmin ? {} : { employeeId: employeeId as string },
                select: { id: true, plate: true, make: true, model: true, nextITVDate: true, insuranceExpiry: true }
            });

            // Generate ICS
            let ics = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//EmpleadosManager//NONSGML v1.0//EN',
                'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH',
                `X-WR-CALNAME:Vacaciones - ${employee.firstName} ${employee.lastName}`,
                'BEGIN:VTIMEZONE',
                'TZID:Europe/Madrid',
                'BEGIN:STANDARD',
                'DTSTART:19701025T030000',
                'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
                'TZOFFSETFROM:+0200',
                'TZOFFSETTO:+0100',
                'TZNAME:CET',
                'END:STANDARD',
                'BEGIN:DAYLIGHT',
                'DTSTART:19700329T020000',
                'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
                'TZOFFSETFROM:+0100',
                'TZOFFSETTO:+0200',
                'TZNAME:CEST',
                'END:DAYLIGHT',
                'END:VTIMEZONE'
            ];

            vacations.forEach(v => {
                const start = v.startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                // For all-day events, DTEND is exclusive, so add 1 day if we were using VALUE=DATE.
                // But here startDate is DateTime in DB.
                // If we want all-day events (cleaner in GCal):
                const startYMD = v.startDate.toISOString().replace(/-/g, '').split('T')[0];
                const endObj = new Date(v.endDate);
                endObj.setDate(endObj.getDate() + 1); // +1 day for exclusive end
                const endYMD = endObj.toISOString().replace(/-/g, '').split('T')[0];

                const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

                ics.push('BEGIN:VEVENT');
                ics.push(`UID:vacation-${v.id}@empleadosmanager`);
                ics.push(`DTSTAMP:${now}`);
                ics.push(`DTSTART;VALUE=DATE:${startYMD}`);
                ics.push(`DTEND;VALUE=DATE:${endYMD}`);
                ics.push(`SUMMARY:${v.type === 'VACATION' ? 'Vacaciones' : v.type || 'Ausencia'} - ${employee.firstName}`);
                ics.push(`DESCRIPTION:${v.reason || 'Sin motivo'}`);
                ics.push('STATUS:CONFIRMED');
                ics.push('END:VEVENT');
                ics.push('END:VEVENT');
            });

            // Add Vehicle Events
            vehicles.forEach((v: any) => {
                if (v.nextITVDate) {
                    const startYMD = v.nextITVDate.toISOString().replace(/-/g, '').split('T')[0];
                    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                    ics.push('BEGIN:VEVENT');
                    ics.push(`UID:itv-${v.id}@empleadosmanager`);
                    ics.push(`DTSTAMP:${now}`);
                    ics.push(`DTSTART;VALUE=DATE:${startYMD}`);
                    ics.push(`DTEND;VALUE=DATE:${startYMD}`); // Single day
                    ics.push(`SUMMARY:ITV - ${v.plate} (${v.make})`);
                    ics.push(`DESCRIPTION:Vencimiento ITV del vehículo ${v.make} ${v.model}.`);
                    ics.push('STATUS:CONFIRMED');
                    ics.push('END:VEVENT');
                }
                if (v.insuranceExpiry) {
                    const startYMD = v.insuranceExpiry.toISOString().replace(/-/g, '').split('T')[0];
                    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                    ics.push('BEGIN:VEVENT');
                    ics.push(`UID:insurance-${v.id}@empleadosmanager`);
                    ics.push(`DTSTAMP:${now}`);
                    ics.push(`DTSTART;VALUE=DATE:${startYMD}`);
                    ics.push(`DTEND;VALUE=DATE:${startYMD}`); // Single day
                    ics.push(`SUMMARY:Seguro - ${v.plate} (${v.make})`);
                    ics.push(`DESCRIPTION:Vencimiento Seguro del vehículo ${v.make} ${v.model}.`);
                    ics.push('STATUS:CONFIRMED');
                    ics.push('END:VEVENT');
                }
            });

            ics.push('END:VCALENDAR');

            res.set('Content-Type', 'text/calendar; charset=utf-8');
            res.set('Content-Disposition', 'attachment; filename="vacaciones.ics"');
            res.send(ics.join('\r\n'));

        } catch (error) {
            console.error('Error generating ICS', error);
            res.status(500).send('Internal Server Error');
        }
    },

    // =========================================
    // UNIFIED CALENDAR ENDPOINTS
    // =========================================

    /**
     * GET /api/calendar/unified
     * Get all unified calendar events (vacations, birthdays, events, holidays)
     */
    getUnifiedEvents: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            if (!user || !user.id) {
                return ApiResponse.error(res, 'Usuario no identificado', 401);
            }

            const { start, end } = req.query;
            
            if (!start || !end) {
                return ApiResponse.error(res, 'Se requieren parámetros start y end', 400);
            }

            const startDate = new Date(start as string);
            const endDate = new Date(end as string);

            // Get user's company
            const userData = await prisma.user.findUnique({
                where: { id: user.id },
                include: { employee: { select: { companyId: true } } }
            });

            const companyId = userData?.employee?.companyId || null;

            const events = await CalendarService.getUnifiedEvents(
                user.id,
                companyId,
                startDate,
                endDate
            );

            return ApiResponse.success(res, events);
        } catch (error) {
            console.error('Error getting unified calendar events:', error);
            return ApiResponse.error(res, 'Error al obtener eventos del calendario', 500);
        }
    },

    /**
     * GET /api/calendar/birthdays
     * Get birthdays for current or specified month
     */
    getBirthdays: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            if (!user || !user.id) {
                return ApiResponse.error(res, 'Usuario no identificado', 401);
            }

            const { month } = req.query;
            
            // Get user's company
            const userData = await prisma.user.findUnique({
                where: { id: user.id },
                include: { employee: { select: { companyId: true } } }
            });

            const companyId = userData?.employee?.companyId || null;
            const monthNum = month ? parseInt(month as string) : undefined;

            const birthdays = await CalendarService.getBirthdays(companyId, monthNum);

            return ApiResponse.success(res, birthdays);
        } catch (error) {
            console.error('Error getting birthdays:', error);
            return ApiResponse.error(res, 'Error al obtener cumpleaños', 500);
        }
    },

    /**
     * POST /api/calendar/events
     * Create a new calendar event (admin/HR only)
     */
    createEvent: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            if (!user || !user.id) {
                return ApiResponse.error(res, 'Usuario no identificado', 401);
            }

            // Check permissions
            const userData = await prisma.user.findUnique({
                where: { id: user.id }
            });

            if (userData?.role !== 'admin' && userData?.role !== 'hr') {
                return ApiResponse.error(res, 'No tienes permisos para crear eventos', 403);
            }

            const { title, description, location, startDate, endDate, allDay, type, color, isPublic } = req.body;

            if (!title || !startDate || !endDate || !type) {
                return ApiResponse.error(res, 'Faltan campos requeridos', 400);
            }

            // Get user's company
            const userWithCompany = await prisma.user.findUnique({
                where: { id: user.id },
                include: { employee: { select: { companyId: true } } }
            });

            const event = await CalendarService.createEvent(
                {
                    title,
                    description,
                    location,
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    allDay: allDay ?? true,
                    type,
                    color,
                    companyId: userWithCompany?.employee?.companyId || undefined,
                    isPublic,
                },
                user.id
            );

            return ApiResponse.success(res, event);
        } catch (error) {
            console.error('Error creating calendar event:', error);
            return ApiResponse.error(res, 'Error al crear evento', 500);
        }
    },

    /**
     * PUT /api/calendar/events/:id
     * Update a calendar event (admin/HR only)
     */
    updateEvent: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            if (!user || !user.id) {
                return ApiResponse.error(res, 'Usuario no identificado', 401);
            }

            // Check permissions
            const userData = await prisma.user.findUnique({
                where: { id: user.id }
            });

            if (userData?.role !== 'admin' && userData?.role !== 'hr') {
                return ApiResponse.error(res, 'No tienes permisos para editar eventos', 403);
            }

            const { id } = req.params;
            const { title, description, location, startDate, endDate, allDay, type, color, isPublic } = req.body;

            const updateData: any = {};
            if (title) updateData.title = title;
            if (description !== undefined) updateData.description = description;
            if (location !== undefined) updateData.location = location;
            if (startDate) updateData.startDate = new Date(startDate);
            if (endDate) updateData.endDate = new Date(endDate);
            if (allDay !== undefined) updateData.allDay = allDay;
            if (type) updateData.type = type;
            if (color !== undefined) updateData.color = color;
            if (isPublic !== undefined) updateData.isPublic = isPublic;

            const event = await CalendarService.updateEvent(id, updateData);

            return ApiResponse.success(res, event);
        } catch (error) {
            console.error('Error updating calendar event:', error);
            return ApiResponse.error(res, 'Error al actualizar evento', 500);
        }
    },

    /**
     * DELETE /api/calendar/events/:id
     * Delete a calendar event (admin only)
     */
    deleteEvent: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            if (!user || !user.id) {
                return ApiResponse.error(res, 'Usuario no identificado', 401);
            }

            // Check permissions (only admin can delete)
            const userData = await prisma.user.findUnique({
                where: { id: user.id }
            });

            if (userData?.role !== 'admin') {
                return ApiResponse.error(res, 'No tienes permisos para eliminar eventos', 403);
            }

            const { id } = req.params;

            await CalendarService.deleteEvent(id);

            return ApiResponse.success(res, { message: 'Evento eliminado correctamente' });
        } catch (error) {
            console.error('Error deleting calendar event:', error);
            return ApiResponse.error(res, 'Error al eliminar evento', 500);
        }
    },

    /**
     * GET /api/calendar/events
     * Get all custom calendar events (admin/HR only)
     */
    getAllEvents: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            if (!user || !user.id) {
                return ApiResponse.error(res, 'Usuario no identificado', 401);
            }

            // Check permissions
            const userData = await prisma.user.findUnique({
                where: { id: user.id }
            });

            if (userData?.role !== 'admin' && userData?.role !== 'hr') {
                return ApiResponse.error(res, 'No tienes permisos para ver eventos', 403);
            }

            // Get user's company
            const userWithCompany = await prisma.user.findUnique({
                where: { id: user.id },
                include: { employee: { select: { companyId: true } } }
            });

            const events = await CalendarService.getAllEvents(userWithCompany?.employee?.companyId || null);

            return ApiResponse.success(res, events);
        } catch (error) {
            console.error('Error getting calendar events:', error);
            return ApiResponse.error(res, 'Error al obtener eventos', 500);
        }
    },
};
