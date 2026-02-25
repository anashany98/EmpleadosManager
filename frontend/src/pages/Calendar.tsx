import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { CalendarEvent as CalendarEventType } from '../types/calendar';

export default function Calendar() {
  const {
    currentDate,
    events,
    isLoading,
    error,
    filters,
    toggleFilter,
    goToToday,
    goToPreviousMonth,
    goToNextMonth,
  } = useCalendarEvents();

  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);

  // Generate calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const getEventsForDay = (day: Date): CalendarEventType[] => {
    return events.filter((event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return day >= eventStart && day <= eventEnd;
    });
  };

  const getEventTypeLabel = (type: string): string => {
    switch (type) {
      case 'vacation-own':
        return 'Vacaciones';
      case 'vacation-team':
        return 'Vacaciones equipo';
      case 'birthday':
        return 'Cumpleaños';
      case 'event':
        return 'Evento';
      case 'holiday':
        return 'Festivo';
      default:
        return type;
    }
  };

  return (
    <div className="calendar-page" style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      {/* Sidebar */}
      <div className="calendar-sidebar" style={{
        width: '280px',
        backgroundColor: '#fff',
        borderRight: '1px solid #e5e7eb',
        padding: '20px',
        overflowY: 'auto'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '20px' }}>
          Calendario
        </h2>

        {/* Filters */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '12px', color: '#6b7280' }}>
            FILTROS
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filters.showVacations}
                onChange={() => toggleFilter('showVacations')}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#22c55e' }}></span>
                Mis Vacaciones
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filters.showTeamVacations}
                onChange={() => toggleFilter('showTeamVacations')}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#86efac' }}></span>
                Vacaciones Equipo
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filters.showBirthdays}
                onChange={() => toggleFilter('showBirthdays')}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#ec4899' }}></span>
                Cumpleaños
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filters.showEvents}
                onChange={() => toggleFilter('showEvents')}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#3b82f6' }}></span>
                Eventos
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filters.showHolidays}
                onChange={() => toggleFilter('showHolidays')}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#6b7280' }}></span>
                Festivos
              </span>
            </label>
          </div>
        </div>

        {/* Legend */}
        <div>
          <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '12px', color: '#6b7280' }}>
            LEYENDA
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#22c55e' }}></span>
              <span style={{ fontSize: '0.875rem' }}>Vacaciones propias</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#86efac' }}></span>
              <span style={{ fontSize: '0.875rem' }}>Vacaciones equipo</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#ec4899' }}></span>
              <span style={{ fontSize: '0.875rem' }}>Cumpleaños</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#3b82f6' }}></span>
              <span style={{ fontSize: '0.875rem' }}>Eventos</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#6b7280' }}></span>
              <span style={{ fontSize: '0.875rem' }}>Festivos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Calendar Area */}
      <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '600' }}>
              {format(currentDate, 'MMMM yyyy', { locale: es })}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={goToToday}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              Hoy
            </button>
            <button
              onClick={goToPreviousMonth}
              style={{
                padding: '8px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              ←
            </button>
            <button
              onClick={goToNextMonth}
              style={{
                padding: '8px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              →
            </button>
          </div>
        </div>

        {/* Loading/Error */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Cargando eventos...</p>
          </div>
        )}
        {error && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>
            <p>{error}</p>
          </div>
        )}

        {/* Calendar Grid */}
        {!isLoading && !error && (
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '8px', 
            border: '1px solid #e5e7eb',
            overflow: 'hidden'
          }}>
            {/* Week Days Header */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(7, 1fr)',
              backgroundColor: '#f9fafb',
              borderBottom: '1px solid #e5e7eb'
            }}>
              {weekDays.map((day) => (
                <div
                  key={day}
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    color: '#6b7280'
                  }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(7, 1fr)',
            }}>
              {calendarDays.map((day, index) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isCurrentDay = isToday(day);
                
                return (
                  <div
                    key={index}
                    style={{
                      minHeight: '100px',
                      padding: '4px',
                      borderRight: (index + 1) % 7 !== 0 ? '1px solid #e5e7eb' : 'none',
                      borderBottom: '1px solid #e5e7eb',
                      backgroundColor: isCurrentMonth ? 'white' : '#f9fafb',
                      opacity: isCurrentMonth ? 1 : 0.5,
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      padding: '4px',
                    }}>
                      <span
                        style={{
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '50%',
                          fontSize: '0.875rem',
                          fontWeight: isCurrentDay ? '600' : '400',
                          backgroundColor: isCurrentDay ? '#3b82f6' : 'transparent',
                          color: isCurrentDay ? 'white' : '#374151',
                        }}
                      >
                        {format(day, 'd')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          style={{
                            padding: '2px 4px',
                            fontSize: '0.7rem',
                            borderRadius: '2px',
                            backgroundColor: event.color,
                            color: '#fff',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: 'pointer',
                          }}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div style={{
                          fontSize: '0.7rem',
                          color: '#6b7280',
                          padding: '2px 4px',
                        }}>
                          +{dayEvents.length - 3} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Event Detail Modal */}
        {selectedEvent && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setSelectedEvent(null)}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '400px',
                width: '90%',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '16px' }}>
                {selectedEvent.title}
              </h3>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ 
                  display: 'inline-block',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  backgroundColor: selectedEvent.color,
                  color: 'white',
                }}>
                  {getEventTypeLabel(selectedEvent.type)}
                </span>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '8px' }}>
                {format(new Date(selectedEvent.start), 'd MMMM yyyy', { locale: es })}
                {selectedEvent.start !== selectedEvent.end && (
                  <> - {format(new Date(selectedEvent.end), 'd MMMM yyyy', { locale: es })}</>
                )}
              </p>
              {selectedEvent.description && (
                <p style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '16px' }}>
                  {selectedEvent.description}
                </p>
              )}
              <button
                onClick={() => setSelectedEvent(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
