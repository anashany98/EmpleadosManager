
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../types/express';
import { ApiResponse } from '../utils/ApiResponse';
import { assertSameTenantOrGlobal } from '../utils/actorContext';
import { CalendarService } from '../services/CalendarService';
import { hasModuleAccess } from '../../../shared/authz';
import { createLogger } from '../services/LoggerService';

const log = createLogger('CalendarController');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
    throw new Error('FATAL: JWT_SECRET must be defined.');
}

function canManageCalendar(user: AuthenticatedRequest['user'] | undefined): boolean {
    return Boolean(user && user.role !== 'employee' && hasModuleAccess(user, 'calendar', 'write'));
}

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

        const backendUrl = process.env.PUBLIC_API_URL || process.env.VITE_API_URL;

        // Devolvemos la URL con la firma en query (requerido por Google/Outlook Calendar).
        // ADVERTENCIA: esta URL debe tratarse como secreta. Rotar si se sospecha fuga
        // (cambiar JWT_SECRET invalida todas las firmas).
        const feedUrl = `${backendUrl}/api/calendar/feed?u=${employee.id}&s=${signature}`;

        return ApiResponse.success(res, { url: feedUrl, headerName: 'X-Calendar-Signature', signature });
    },

    getFeed: async (req: Request, res: Response) => {
        const { u: employeeId } = req.query;
        // Preferir header (no se loguea por defecto); fallback a query para clientes calendario externos
        const headerSignature = req.header('X-Calendar-Signature');
        const querySignature = req.query.s as string | undefined;
        const signature = (headerSignature || querySignature) as string | undefined;

        if (!employeeId || !signature) {
            return res.status(400).send('Missing parameters');
        }

        // Defensa M6: si la firma viaja por query string, queda registrada en logs
        // de nginx / proxies / Referer. Avisamos para que el cliente migre a header.
        if (!headerSignature && querySignature) {
            log.warn(
                { employeeId, requestId: res.locals.requestId },
                'Calendar feed accessed with signature in query string; recommend X-Calendar-Signature header'
            );
        }

        // Verify signature usando comparación de tiempo constante para evitar timing attacks
        const expected = crypto.createHmac('sha256', SECRET)
            .update(employeeId as string)
            .digest('hex');

        const signatureBuffer = Buffer.from(String(signature));
        const expectedBuffer = Buffer.from(expected);
        if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
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

            const vehicles = await prisma.vehicle.findMany({
                where: isAdmin ? {} : { employeeId: employeeId as string },
                select: { id: true, plate: true, make: true, model: true, nextITVDate: true, insuranceExpiry: true }
            });

            // Generate ICS
            const ics = [
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
                const startYMD = v.startDate.toISOString().replace(/-/g, '').split('T')[0];
                const endObj = new Date(v.endDate);
                endObj.setDate(endObj.getDate() + 1); // +1 day for exclusive end
                const endYMD = endObj.toISOString().replace(/-/g, '').split('T')[0];

                const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

                // Map vacation types to readable titles
                const typeTitles: Record<string, string> = {
                    'VACATION': 'Vacaciones',
                    'SICK': 'Baja Médica',
                    'SICK_LEAVE': 'Baja Médica',
                    'BAJA_MEDICA': 'Baja Médica',
                    'MATERNITY': 'Maternidad',
                    'MATERNIDAD': 'Maternidad',
                    'PATERNITY': 'Paternidad',
                    'PATERNIDAD': 'Paternidad',
                    'BIRTH': 'Nacimiento',
                    'MEDICAL_HOURS': 'Horas Médicas',
                    'LACTANCIA': 'Lactancia',
                    'PERSONAL': 'Personal',
                    'PERSONAL_DAY': 'Día Personal',
                    'OTHER': 'Otro',
                    'OTROS': 'Otro',
                    'UNPAID': 'Sin Goce',
                    'TELETRABAJO': 'Teletrabajo',
                    'PERMISO_SINDICAL': 'Permiso Sindical'
                };
                
                const summary = typeTitles[v.type || 'VACATION'] || v.type || 'Ausencia';
                
                ics.push('BEGIN:VEVENT');
                ics.push(`UID:vacation-${v.id}@empleadosmanager`);
                ics.push(`DTSTAMP:${now}`);
                ics.push(`DTSTART;VALUE=DATE:${startYMD}`);
                ics.push(`DTEND;VALUE=DATE:${endYMD}`);
                ics.push(`SUMMARY:${summary} - ${employee.firstName}`);
                ics.push(`DESCRIPTION:${v.reason || 'Sin motivo'}`);
                ics.push('STATUS:CONFIRMED');
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

        } catch {
            log.error('Error generating ICS');
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

            if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
                return ApiResponse.error(res, 'Las fechas start y end son inválidas', 400);
            }

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
        } catch {
            log.error('Error getting unified calendar events');
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
        } catch {
            log.error('Error getting birthdays');
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

            if (!canManageCalendar(user)) {
                return ApiResponse.error(res, 'No tienes permisos para crear eventos', 403);
            }

            const { title, description, location, startDate, endDate, allDay, type, color, isPublic } = req.body;

            if (!title || !startDate || !endDate || !type) {
                return ApiResponse.error(res, 'Faltan campos requeridos', 400);
            }

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
                    companyId: user.companyId || undefined,
                    isPublic,
                },
                user.id
            );

            return ApiResponse.success(res, event);
        } catch {
            log.error('Error creating calendar event');
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

            if (!canManageCalendar(user)) {
                return ApiResponse.error(res, 'No tienes permisos para editar eventos', 403);
            }

            const { id } = req.params;

            // HIGH-002: verificamos tenant antes de actualizar
            const existing = await prisma.calendarEvent.findUnique({
                where: { id },
                select: { companyId: true }
            });
            if (!existing) {
                return ApiResponse.error(res, 'Evento no encontrado', 404);
            }
            if (!assertSameTenantOrGlobal(user, existing.companyId)) {
                log.warn({ id, userId: user.id }, 'Cross-tenant calendar event update blocked');
                return ApiResponse.error(res, 'Evento no encontrado', 404);
            }

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
        } catch {
            log.error('Error updating calendar event');
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

            if (!canManageCalendar(user)) {
                return ApiResponse.error(res, 'No tienes permisos para eliminar eventos', 403);
            }

            const { id } = req.params;

            // HIGH-002: verificamos tenant antes de eliminar
            const existing = await prisma.calendarEvent.findUnique({
                where: { id },
                select: { companyId: true }
            });
            if (!existing) {
                return ApiResponse.error(res, 'Evento no encontrado', 404);
            }
            if (!assertSameTenantOrGlobal(user, existing.companyId)) {
                log.warn({ id, userId: user.id }, 'Cross-tenant calendar event delete blocked');
                return ApiResponse.error(res, 'Evento no encontrado', 404);
            }

            await CalendarService.deleteEvent(id);

            return ApiResponse.success(res, { message: 'Evento eliminado correctamente' });
        } catch {
            log.error('Error deleting calendar event');
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

            if (!canManageCalendar(user)) {
                return ApiResponse.error(res, 'No tienes permisos para ver eventos', 403);
            }

            const events = await CalendarService.getAllEvents(user.companyId || null);

            return ApiResponse.success(res, events);
        } catch {
            log.error('Error getting calendar events');
            return ApiResponse.error(res, 'Error al obtener eventos', 500);
        }
    },

    getConflicts: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const companyId = user?.companyId;
            const { date } = req.query;
            if (!date) return ApiResponse.error(res, 'Fecha requerida', 400);

            const targetDate = new Date(date as string);
            const nextDay = new Date(targetDate);
            nextDay.setDate(nextDay.getDate() + 1);

            const vacations = await prisma.vacation.findMany({
                where: {
                    status: 'APPROVED',
                    startDate: { lte: targetDate },
                    endDate: { gte: targetDate },
                    employee: companyId ? { companyId } : undefined,
                },
                include: { employee: { select: { department: true } } },
                take: 200
            });

            const departmentCount: Record<string, number> = {};
            vacations.forEach((v) => {
                const dept = v.employee?.department || 'Sin departamento';
                departmentCount[dept] = (departmentCount[dept] || 0) + 1;
            });

            const conflicts: Array<{ department: string; absentCount: number; totalCount: number; percentage: number }> = [];
            for (const [dept, absentCount] of Object.entries(departmentCount)) {
                const totalEmployees = await prisma.employee.count({
                    where: { department: dept, active: true, ...(companyId ? { companyId } : {}) }
                });
                const percentage = totalEmployees > 0 ? (absentCount / totalEmployees) * 100 : 0;
                if (percentage >= 30) {
                    conflicts.push({ department: dept, absentCount, totalCount: totalEmployees, percentage: Math.round(percentage) });
                }
            }

            return ApiResponse.success(res, { date: date as string, conflicts });
        } catch (error) {
            log.error({ error }, 'Error checking conflicts');
            return ApiResponse.error(res, 'Error al verificar conflictos', 500);
        }
    },

    exportIcs: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            if (!user?.id) return ApiResponse.error(res, 'No autenticado', 401);

            const startStr = (req.query.start as string) || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
            const endStr = (req.query.end as string) || new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0];
            const startDate = new Date(startStr);
            const endDate = new Date(endStr);

            const events = await CalendarService.getUnifiedEvents(user.id, user.companyId || null, startDate, endDate);

            const icsLines = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//EmpleadosManager//Calendario//ES',
                'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH',
                'X-WR-CALNAME:EmpleadosManager',
                'X-WR-TIMEZONE:Europe/Madrid'
            ];

            events.forEach((event) => {
                const uid = `${event.id}@empleadosmanager`;
                const dtStart = new Date(event.start).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                const dtEnd = new Date(event.end).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

                icsLines.push('BEGIN:VEVENT');
                icsLines.push(`UID:${uid}`);
                icsLines.push(`DTSTAMP:${now}`);
                icsLines.push(`DTSTART;VALUE=DATE:${dtStart.replace(/T.*/, '')}`);
                icsLines.push(`DTEND;VALUE=DATE:${dtEnd.replace(/T.*/, '')}`);
                icsLines.push(`SUMMARY:${event.title}`);
                if (event.description) icsLines.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`);
                if (event.location) icsLines.push(`LOCATION:${event.location}`);
                icsLines.push('END:VEVENT');
            });

            icsLines.push('END:VCALENDAR');

            res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="empleadosmanager.ics"');
            return res.send(icsLines.join('\r\n'));
        } catch (error) {
            log.error({ error }, 'Error exporting ICS');
            return ApiResponse.error(res, 'Error al exportar calendario', 500);
        }
    },

    getReminders: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            if (!user?.id) return ApiResponse.error(res, 'No autenticado', 401);

            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const weekFromNow = new Date(today);
            weekFromNow.setDate(weekFromNow.getDate() + 7);

            const events = await CalendarService.getUnifiedEvents(user.id, user.companyId || null, today, weekFromNow);

            const reminders = events.filter((event) => {
                const start = new Date(event.start);
                const diffDays = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return diffDays >= 0 && diffDays <= 7;
            }).map((event) => {
                const start = new Date(event.start);
                const diffDays = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return { ...event, daysUntil: diffDays };
            });

            return ApiResponse.success(res, reminders);
        } catch (error) {
            log.error({ error }, 'Error getting reminders');
            return ApiResponse.error(res, 'Error al obtener recordatorios', 500);
        }
    }
};
