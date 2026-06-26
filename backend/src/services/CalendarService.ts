import { prisma } from '../lib/prisma';
import { format, parseISO } from 'date-fns';
import { normalizeRole } from '../../../shared/authz';

export interface CalendarEventInput {
  title: string;
  description?: string;
  location?: string;
  startDate: Date;
  endDate: Date;
  allDay?: boolean;
  type: 'EVENT' | 'HOLIDAY' | 'BIRTHDAY' | 'CORPORATE';
  color?: string;
  companyId?: string;
  isPublic?: boolean;
}

export interface UnifiedCalendarEvent {
  id: string;
  entityId: string;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  type: 'vacation-own' | 'vacation-team' | 'birthday' | 'event' | 'holiday' | 'fichaje';
  color: string;
  source: 'vacation' | 'calendar_event' | 'birthday' | 'holiday';
  editable: boolean;
  deletable: boolean;
  calendarEventType?: string;
  employeeId?: string;
  employeeName?: string;
  employeeDepartment?: string | null;
}

// Spanish holidays for 2026
const SPAIN_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: 'Año Nuevo' },
  { date: '2026-01-06', name: 'Epifanía del Señor' },
  { date: '2026-04-17', name: 'Viernes Santo' },
  { date: '2026-04-20', name: 'Lunes de Pascua' },
  { date: '2026-05-01', name: 'Fiesta del Trabajo' },
  { date: '2026-08-15', name: 'Asunción de la Virgen' },
  { date: '2026-10-12', name: 'Fiesta Nacional de España' },
  { date: '2026-11-01', name: 'Todos los Santos' },
  { date: '2026-12-06', name: 'Día de la Constitución' },
  { date: '2026-12-08', name: 'Inmaculada Concepción' },
  { date: '2026-12-25', name: 'Natividad del Señor' },
];

export const CalendarService = {
  /**
   * Get all unified calendar events for a date range
   */
  async getUnifiedEvents(
    userId: string,
    companyId: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<UnifiedCalendarEvent[]> {
    const events: UnifiedCalendarEvent[] = [];

    // Get user and employee info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true }
    });

    const normalizedRole = normalizeRole(user?.role);
    const isCompanyStaff = normalizedRole === 'admin' || normalizedRole === 'hr' || normalizedRole === 'manager';
    const currentEmployeeId = user?.employeeId;

    // 1. Get approved vacations
    const vacations = await prisma.vacation.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        employee: companyId ? { companyId } : undefined,
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true, department: true } } },
      orderBy: { startDate: 'asc' },
      take: 500
    });

    vacations.forEach((vacation) => {
      const isOwn = vacation.employeeId === currentEmployeeId;
      events.push({
        id: `vacation-${vacation.id}`,
        entityId: vacation.id,
        title: isOwn 
          ? 'Vacaciones' 
          : `${vacation.employee.firstName} ${vacation.employee.lastName} - Vacaciones`,
        description: vacation.reason || undefined,
        start: vacation.startDate,
        end: vacation.endDate,
        allDay: true,
        type: isOwn ? 'vacation-own' : 'vacation-team',
        color: isOwn ? '#22c55e' : '#86efac', // green-500 vs green-300
        source: 'vacation',
        editable: false,
        deletable: false,
        employeeId: vacation.employeeId,
        employeeName: `${vacation.employee.firstName} ${vacation.employee.lastName}`,
        employeeDepartment: vacation.employee.department,
      });
    });

    // 2. Get birthdays (calculate based on birthDate)
    if (isCompanyStaff) {
      const employees = await prisma.employee.findMany({
        where: {
          active: true,
          birthDate: { not: null },
          companyId: companyId || undefined,
        },
        select: { id: true, firstName: true, lastName: true, birthDate: true, department: true },
        take: 500
      });

      employees.forEach((emp) => {
        if (!emp.birthDate) return;
        
        const birthDate = new Date(emp.birthDate);
        const currentYear = startDate.getFullYear();
        
        // Create birthday date for current year
        const birthdayThisYear = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
        
        // Check if birthday falls within the date range
        if (birthdayThisYear >= startDate && birthdayThisYear <= endDate) {
          const age = currentYear - birthDate.getFullYear();
          events.push({
            id: `birthday-${emp.id}-${currentYear}`,
            entityId: emp.id,
            title: `🎂 ${emp.firstName} ${emp.lastName} (${age})`,
            start: birthdayThisYear,
            end: birthdayThisYear,
            allDay: true,
            type: 'birthday',
            color: '#ec4899', // pink-500
            source: 'birthday',
            editable: false,
            deletable: false,
            employeeId: emp.id,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            employeeDepartment: emp.department,
          });
        }
      });
    }

    // 3. Get custom calendar events (with recurrence expansion)
    const calendarEvents = await prisma.calendarEvent.findMany({
      where: {
        AND: [
          {
            OR: [
              { companyId },
              { isPublic: true, companyId: null },
            ],
          },
          { startDate: { lte: endDate } },
          {
            OR: [
              { recurrence: 'NONE' },
              { recurrenceEnd: null },
              { recurrenceEnd: { gte: startDate } }
            ]
          }
        ]
      },
      orderBy: { startDate: 'asc' },
      take: 1000
    });

    const customHolidayDates = new Set(
      calendarEvents
        .filter((event) => event.type === 'HOLIDAY')
        .map((event) => format(event.startDate, 'yyyy-MM-dd'))
    );

    calendarEvents.forEach((event) => {
      // Expand recurring events
      if (event.recurrence && event.recurrence !== 'NONE') {
        const originalStart = new Date(event.startDate);
        const originalEnd = new Date(event.endDate);
        const duration = originalEnd.getTime() - originalStart.getTime();
        const recEnd = event.recurrenceEnd ? new Date(event.recurrenceEnd) : endDate;
        const effectiveEnd = recEnd < endDate ? recEnd : endDate;

        let currentStart = new Date(originalStart);
        let instanceCount = 0;
        const MAX_INSTANCES = 100;

        while (currentStart <= effectiveEnd && instanceCount < MAX_INSTANCES) {
          if (currentStart >= startDate) {
            const instEnd = new Date(currentStart.getTime() + duration);
            events.push({
              id: `event-${event.id}-${instanceCount}`,
              entityId: event.id,
              title: event.title,
              description: event.description || undefined,
              location: event.location || undefined,
              start: currentStart,
              end: instEnd,
              allDay: event.allDay,
              type: event.type === 'HOLIDAY' ? 'holiday' : 'event',
              color: event.color || (event.type === 'HOLIDAY' ? '#6b7280' : '#3b82f6'),
              source: 'calendar_event',
              editable: true,
              deletable: instanceCount === 0,
              calendarEventType: event.type,
            });
          }

          if (event.recurrence === 'WEEKLY') {
            currentStart.setDate(currentStart.getDate() + 7);
          } else if (event.recurrence === 'MONTHLY') {
            currentStart.setMonth(currentStart.getMonth() + 1);
          } else {
            break;
          }
          instanceCount++;
        }
      } else {
        events.push({
          id: `event-${event.id}`,
          entityId: event.id,
          title: event.title,
          description: event.description || undefined,
          location: event.location || undefined,
          start: event.startDate,
          end: event.endDate,
          allDay: event.allDay,
          type: event.type === 'HOLIDAY' ? 'holiday' : 'event',
          color: event.color || (event.type === 'HOLIDAY' ? '#6b7280' : '#3b82f6'),
          source: 'calendar_event',
          editable: true,
          deletable: true,
          calendarEventType: event.type,
        });
      }
    });

    // 4. Add Spanish holidays, unless the company already has a holiday on that date
    SPAIN_HOLIDAYS_2026.forEach((holiday) => {
      const holidayDate = parseISO(holiday.date);
      const holidayKey = format(holidayDate, 'yyyy-MM-dd');

      if (holidayDate >= startDate && holidayDate <= endDate && !customHolidayDates.has(holidayKey)) {
        events.push({
          id: `holiday-${holiday.date}`,
          entityId: holiday.date,
          title: `⚫ ${holiday.name}`,
          start: holidayDate,
          end: holidayDate,
          allDay: true,
          type: 'holiday',
          color: '#6b7280', // gray-500
          source: 'holiday',
          editable: false,
          deletable: false,
        });
      }
    });

    // Sort by start date
    events.sort((a, b) => a.start.getTime() - b.start.getTime());

    return events;
  },

  /**
   * Get birthdays for current month
   */
  async getBirthdays(companyId: string | null, month?: number): Promise<UnifiedCalendarEvent[]> {
    const currentMonth = month || new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0);

    const employees = await prisma.employee.findMany({
      where: {
        active: true,
        birthDate: { not: null },
        companyId: companyId || undefined,
      },
      select: { id: true, firstName: true, lastName: true, birthDate: true },
      take: 500
    });

    const birthdays: UnifiedCalendarEvent[] = [];
    
    employees.forEach((emp) => {
      if (!emp.birthDate) return;
      
      const birthDate = new Date(emp.birthDate);
      const birthdayThisYear = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
      
      if (birthdayThisYear >= startDate && birthdayThisYear <= endDate) {
        const age = currentYear - birthDate.getFullYear();
        birthdays.push({
          id: `birthday-${emp.id}-${currentYear}`,
          entityId: emp.id,
          title: `🎂 ${emp.firstName} ${emp.lastName} cumple ${age}`,
          start: birthdayThisYear,
          end: birthdayThisYear,
          allDay: true,
          type: 'birthday',
          color: '#ec4899',
          source: 'birthday',
          editable: false,
          deletable: false,
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          employeeDepartment: null,
        });
      }
    });

    return birthdays.sort((a, b) => a.start.getTime() - b.start.getTime());
  },

  /**
   * Create a new calendar event
   */
  async createEvent(data: CalendarEventInput, createdBy: string): Promise<any> {
    return prisma.calendarEvent.create({
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        startDate: data.startDate,
        endDate: data.endDate,
        allDay: data.allDay ?? true,
        type: data.type,
        color: data.color,
        companyId: data.companyId,
        createdBy,
        isPublic: data.isPublic ?? true,
        recurrence: (data as any).recurrence || 'NONE',
        recurrenceEnd: (data as any).recurrenceEnd || null,
      },
    });
  },

  /**
   * Update a calendar event
   */
  async updateEvent(id: string, data: Partial<CalendarEventInput>): Promise<any> {
    return prisma.calendarEvent.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        startDate: data.startDate,
        endDate: data.endDate,
        allDay: data.allDay,
        type: data.type,
        color: data.color,
        isPublic: data.isPublic,
      },
    });
  },

  /**
   * Delete a calendar event
   */
  async deleteEvent(id: string): Promise<void> {
    await prisma.calendarEvent.delete({
      where: { id },
    });
  },

  /**
   * Get all calendar events (admin/HR only)
   */
  async getAllEvents(companyId: string | null): Promise<any[]> {
    return prisma.calendarEvent.findMany({
      where: {
        OR: [
          { companyId },
          { companyId: null },
        ],
      },
      include: {
        creator: { select: { email: true } },
        company: { select: { name: true } },
      },
      orderBy: { startDate: 'asc' },
      take: 1000
    });
  },
};
