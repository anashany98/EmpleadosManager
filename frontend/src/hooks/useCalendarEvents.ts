import { useState, useEffect, useCallback } from 'react';
import type { CalendarEvent, CalendarFilters } from '../types/calendar';
import { DEFAULT_CALENDAR_FILTERS } from '../types/calendar';
import { startOfMonth, endOfMonth, format } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function useCalendarEvents(initialDate?: Date) {
  const [currentDate, setCurrentDate] = useState(initialDate || new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_CALENDAR_FILTERS);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      
      const response = await fetch(
        `${API_URL}/api/calendar/unified?start=${start}&end=${end}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Error al cargar eventos del calendario');
      }

      const data = await response.json();
      setEvents(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filteredEvents = events.filter((event) => {
    switch (event.type) {
      case 'vacation-own':
        return filters.showVacations;
      case 'vacation-team':
        return filters.showTeamVacations;
      case 'birthday':
        return filters.showBirthdays;
      case 'event':
        return filters.showEvents;
      case 'holiday':
        return filters.showHolidays;
      default:
        return true;
    }
  });

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const toggleFilter = (filter: keyof CalendarFilters) => {
    setFilters((prev) => ({
      ...prev,
      [filter]: !prev[filter],
    }));
  };

  return {
    currentDate,
    setCurrentDate,
    events: filteredEvents,
    allEvents: events,
    isLoading,
    error,
    filters,
    toggleFilter,
    goToToday,
    goToPreviousMonth,
    goToNextMonth,
    refetch: fetchEvents,
  };
}
