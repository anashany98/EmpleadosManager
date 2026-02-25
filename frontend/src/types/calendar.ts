export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
  type: 'vacation-own' | 'vacation-team' | 'birthday' | 'event' | 'holiday' | 'fichaje';
  color: string;
  employeeId?: string;
  employeeName?: string;
}

export interface CalendarFilters {
  showVacations: boolean;
  showTeamVacations: boolean;
  showBirthdays: boolean;
  showEvents: boolean;
  showHolidays: boolean;
}

export const DEFAULT_CALENDAR_FILTERS: CalendarFilters = {
  showVacations: true,
  showTeamVacations: true,
  showBirthdays: true,
  showEvents: true,
  showHolidays: true,
};

export const EVENT_COLORS = {
  'vacation-own': '#22c55e', // green-500
  'vacation-team': '#86efac', // green-300
  'birthday': '#ec4899', // pink-500
  'event': '#3b82f6', // blue-500
  'holiday': '#6b7280', // gray-500
  'fichaje': '#f97316', // orange-500
};
