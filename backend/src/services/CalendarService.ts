import { prisma } from '../lib/prisma';
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns';

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
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  type: 'vacation-own' | 'vacation-team' | 'birthday' | 'event' | 'holiday' | 'fichaje';
  color: string;
  employeeId?: string;
  employeeName?: string;
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

    const isAdmin = user?.role === 'admin';
    const isHR = user?.role === 'hr' || user?.role === 'admin';
    const currentEmployeeId = user?.employeeId;

    // 1. Get approved vacations
    const vacations = await prisma.vacation.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        employee: companyId ? { companyId } : undefined,
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { startDate: 'asc' }
    });

    vacations.forEach((vacation) => {
      const isOwn = vacation.employeeId === currentEmployeeId;
      events.push({
        id: `vacation-${vacation.id}`,
        title: isOwn 
          ? 'Vacaciones' 
          : `${vacation.employee.firstName} ${vacation.employee.lastName} - Vacaciones`,
        description: vacation.reason || undefined,
        start: vacation.startDate,
        end: vacation.endDate,
        allDay: true,
        type: isOwn ? 'vacation-own' : 'vacation-team',
        color: isOwn ? '#22c55e' : '#86efac', // green-500 vs green-300
        employeeId: vacation.employeeId,
        employeeName: `${vacation.employee.firstName} ${vacation.employee.lastName}`,
      });
    });

    // 2. Get birthdays (calculate based on birthDate)
    if (isHR || isAdmin) {
      const employees = await prisma.employee.findMany({
        where: {
          active: true,
          birthDate: { not: null },
          companyId: companyId || undefined,
        },
        select: { id: true, firstName: true, lastName: true, birthDate: true }
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
            title: `🎂 ${emp.firstName} ${emp.lastName} (${age})`,
            start: birthdayThisYear,
            end: birthdayThisYear,
            allDay: true,
            type: 'birthday',
            color: '#ec4899', // pink-500
            employeeId: emp.id,
            employeeName: `${emp.firstName} ${emp.lastName}`,
          });
        }
      });
    }

    // 3. Get custom calendar events
    const calendarEvents = await prisma.calendarEvent.findMany({
      where: {
        OR: [
          { companyId: companyId },
          { isPublic: true, companyId: null },
        ],
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      orderBy: { startDate: 'asc' }
    });

    calendarEvents.forEach((event) => {
      events.push({
        id: `event-${event.id}`,
        title: event.title,
        description: event.description || undefined,
        location: event.location || undefined,
        start: event.startDate,
        end: event.endDate,
        allDay: event.allDay,
        type: event.type === 'HOLIDAY' ? 'holiday' : 'event',
        color: event.color || (event.type === 'HOLIDAY' ? '#6b7280' : '#3b82f6'), // gray-500 or blue-500
      });
    });

    // 4. Add Spanish holidays if no company-specific holidays
    if (!companyId) {
      SPAIN_HOLIDAYS_2026.forEach((holiday) => {
        const holidayDate = parseISO(holiday.date);
        if (holidayDate >= startDate && holidayDate <= endDate) {
          events.push({
            id: `holiday-${holiday.date}`,
            title: `⚫ ${holiday.name}`,
            start: holidayDate,
            end: holidayDate,
            allDay: true,
            type: 'holiday',
            color: '#6b7280', // gray-500
          });
        }
      });
    }

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
      select: { id: true, firstName: true, lastName: true, birthDate: true }
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
          title: `🎂 ${emp.firstName} ${emp.lastName} cumple ${age}`,
          start: birthdayThisYear,
          end: birthdayThisYear,
          allDay: true,
          type: 'birthday',
          color: '#ec4899',
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
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
        createdBy: createdBy,
        isPublic: data.isPublic ?? true,
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
          { companyId: companyId },
          { companyId: null },
        ],
      },
      include: {
        creator: { select: { email: true } },
        company: { select: { name: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  },
};
