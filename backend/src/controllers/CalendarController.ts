
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../types/express';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';

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
    }
};
