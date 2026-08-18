import { useCallback, useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { Clock, Calendar, ChevronLeft, ChevronRight, User, MapPin, HardHat, Sun } from 'lucide-react';
import LocationMapModal from '../components/LocationMapModal';
import ObraHoursModal from '../features/employee-detail/components/ObraHoursModal';

interface Employee {
  id: string;
  name: string;
  department: string;
}

interface TimeEntry {
  id: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  lunchStart?: string;
  lunchEnd?: string;
  totalHours: number;
  lunchHours: number;
  lat?: number;
  lng?: number;
  /** Marca los días con vacaciones aprobadas mostrados junto a los fichajes. */
  isVacation?: boolean;
  vacationReason?: string;
  employee: {
    id: string;
    name: string;
    department: string;
  };
}

import { useAuth } from '../contexts/AuthContext';

interface RawTimeEntry {
  id: string;
  employeeId: string;
  type: 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END' | 'LUNCH_START' | 'LUNCH_END';
  timestamp: string;
  latitude?: number | null;
  longitude?: number | null;
  employee?: {
    id?: string;
    name?: string;
    department?: string;
  };
}

const toLocalDateString = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeTimeEntries = (payload: unknown): TimeEntry[] => {
  if (!Array.isArray(payload) || payload.length === 0) return [];

  const first = payload[0] as Partial<TimeEntry>;
  const alreadyNormalized = typeof first?.date === 'string' && typeof first?.totalHours === 'number';
  if (alreadyNormalized) return payload as TimeEntry[];

  const rows = payload as RawTimeEntry[];
  const grouped = new Map<string, TimeEntry & { __in?: number; __out?: number; __lunchStart?: number; __lunchEnd?: number }>();

  const ordered = [...rows].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  for (const row of ordered) {
    const ts = new Date(row.timestamp);
    if (Number.isNaN(ts.getTime())) continue;

    const day = toLocalDateString(ts);
    const employeeId = row.employeeId || row.employee?.id || 'unknown';
    const key = `${employeeId}-${day}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        id: key,
        date: `${day}T00:00:00.000Z`,
        checkIn: undefined,
        checkOut: undefined,
        lunchStart: undefined,
        lunchEnd: undefined,
        totalHours: 0,
        lunchHours: 0,
        employee: {
          id: employeeId,
          name: row.employee?.name || 'Empleado',
          department: row.employee?.department || 'Sin departamento'
        }
      });
    }

    const target = grouped.get(key)!;
    const ms = ts.getTime();

    if ((row.type === 'IN' || row.type === 'OUT') && Number.isFinite(row.latitude) && Number.isFinite(row.longitude)) {
      target.lat = Number(row.latitude);
      target.lng = Number(row.longitude);
    }

    if (row.type === 'IN' && (!target.__in || ms < target.__in)) {
      target.__in = ms;
      target.checkIn = row.timestamp;
    }
    if (row.type === 'OUT' && (!target.__out || ms > target.__out)) {
      target.__out = ms;
      target.checkOut = row.timestamp;
    }
    if (row.type === 'LUNCH_START' && (!target.__lunchStart || ms < target.__lunchStart)) {
      target.__lunchStart = ms;
      target.lunchStart = row.timestamp;
    }
    if (row.type === 'LUNCH_END' && (!target.__lunchEnd || ms > target.__lunchEnd)) {
      target.__lunchEnd = ms;
      target.lunchEnd = row.timestamp;
    }
  }

  return Array.from(grouped.values()).map((entry) => {
    const gross = entry.__in && entry.__out && entry.__out > entry.__in
      ? (entry.__out - entry.__in) / 3600000
      : 0;
    const lunch = entry.__lunchStart && entry.__lunchEnd && entry.__lunchEnd > entry.__lunchStart
      ? (entry.__lunchEnd - entry.__lunchStart) / 3600000
      : 0;

    return {
      ...entry,
      lunchHours: lunch,
      totalHours: Math.max(0, gross - lunch),
    };
  });
};

interface VacationApi {
  id: string;
  startDate: string;
  endDate: string;
  type?: string | null;
  status?: string | null;
  reason?: string | null;
  employee?: {
    id?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    department?: string;
  } | null;
}

interface VacationDayInfo {
  reason?: string;
  employee: { id: string; name: string; department: string };
}

const VACATION_TYPES = new Set(['VACATION', 'VACACIONES']);

/**
 * Expande las vacaciones aprobadas del mes a un mapa por día (para el
 * calendario) y por empleado+día (para la lista), aplicando los filtros
 * de departamento/empleado activos. Solo cuenta ausencias tipo vacaciones
 * en estado APPROVED/EXISTING, igual que el control horario del empleado.
 */
function buildVacationMaps(
  vacations: VacationApi[],
  year: number,
  month: number,
  selectedEmployee: string,
  selectedDepartment: string,
  employees: Employee[]
): {
  byDate: Map<string, { count: number; names: string[] }>;
  byEmployeeDay: Map<string, VacationDayInfo>;
} {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const byDate = new Map<string, { count: number; names: string[] }>();
  const byEmployeeDay = new Map<string, VacationDayInfo>();

  for (const vac of vacations) {
    const status = String(vac.status || 'APPROVED').toUpperCase().trim();
    if (status !== 'APPROVED' && status !== 'EXISTING') continue;
    const type = String(vac.type || 'VACATION').toUpperCase().trim();
    if (!VACATION_TYPES.has(type)) continue;

    const vacEmp = vac.employee;
    const employeeId = vacEmp?.id;
    if (!employeeId) continue;

    const employee = employees.find((item) => item.id === employeeId) || {
      id: employeeId,
      name: vacEmp?.name || [vacEmp?.firstName, vacEmp?.lastName].filter(Boolean).join(' ').trim() || 'Empleado',
      department: vacEmp?.department || ''
    };
    if (selectedEmployee !== 'all' && employeeId !== selectedEmployee) continue;
    if (selectedDepartment !== 'all' && employee.department !== selectedDepartment) continue;

    const rawStart = new Date(vac.startDate);
    const rawEnd = new Date(vac.endDate);
    if (Number.isNaN(rawStart.getTime()) || Number.isNaN(rawEnd.getTime())) continue;

    const start = new Date(Date.UTC(rawStart.getUTCFullYear(), rawStart.getUTCMonth(), rawStart.getUTCDate()));
    const end = new Date(Date.UTC(rawEnd.getUTCFullYear(), rawEnd.getUTCMonth(), rawEnd.getUTCDate(), 23, 59, 59, 999));
    const cursor = new Date(Math.max(start.getTime(), monthStart.getTime()));
    cursor.setUTCHours(0, 0, 0, 0);
    const limit = new Date(Math.min(end.getTime(), monthEnd.getTime()));
    limit.setUTCHours(23, 59, 59, 999);

    while (cursor <= limit) {
      const dayKey = cursor.toISOString().slice(0, 10);
      const mapKey = `${employeeId}|${dayKey}`;
      if (!byEmployeeDay.has(mapKey)) {
        byEmployeeDay.set(mapKey, { reason: vac.reason || undefined, employee });
      }
      const dayInfo = byDate.get(dayKey) || { count: 0, names: [] };
      dayInfo.count += 1;
      if (employee.name && !dayInfo.names.includes(employee.name)) dayInfo.names.push(employee.name);
      byDate.set(dayKey, dayInfo);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return { byDate, byEmployeeDay };
}

export default function TimesheetPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [vacations, setVacations] = useState<VacationApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const [mapLocation, setMapLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [obraModal, setObraModal] = useState<{ employeeId: string; date: string; hours: number } | null>(null);

  const handleViewMap = (lat?: number, lng?: number) => {
    const hasCoords = typeof lat === 'number' && Number.isFinite(lat) &&
      typeof lng === 'number' && Number.isFinite(lng);
    if (hasCoords) {
      setMapLocation({ lat: lat as number, lng: lng as number });
      setIsMapOpen(true);
    } else {
      toast.error('No hay ubicación registrada para este fichaje');
    }
  };

  useEffect(() => {
    if (!isAdmin && user?.employeeId) {
      setSelectedEmployee(user.employeeId);
    }
  }, [user, isAdmin]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: Employee[] }>('/employees');
      setEmployees(res.data || res || []);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar empleados');
    }
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const startDate = toLocalDateString(new Date(year, month - 1, 1));
      const endDate = toLocalDateString(new Date(year, month, 0));

      const url = selectedEmployee === 'all'
        ? `/time-entries/range?from=${startDate}&to=${endDate}`
        : `/time-entries/range?from=${startDate}&to=${endDate}&employeeId=${selectedEmployee}`;

      const res = await api.get<{ success: boolean; data: { data: RawTimeEntry[]; pagination?: unknown } }>(url);
      // El backend devuelve { data: { data: [...], pagination } } dentro del
      // envelope, así que hay que desempaquetar dos niveles para llegar al array.
      setEntries(normalizeTimeEntries(res.data?.data || res.data || res || []));

      try {
        const vacRes = await api.get<{ success: boolean; data: unknown }>('/vacations', { params: { startDate, endDate, limit: 500 } });
        const rawVacations: unknown = vacRes.data;
        const vacList = Array.isArray(rawVacations)
            ? (rawVacations as VacationApi[])
            : ((rawVacations as { data?: VacationApi[] } | null)?.data ?? []);
        setVacations(vacList);
      } catch (vacError) {
        console.error('Error al cargar vacaciones', vacError);
        setVacations([]);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar fichajes');
    } finally {
      setLoading(false);
    }
  }, [currentMonth, selectedEmployee]);

  useEffect(() => {
    void fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '--:--';
    return new Date(dateString).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort();

  const filteredEmployees = employees.filter(emp =>
    selectedDepartment === 'all' || emp.department === selectedDepartment
  );

  const displayedEntries = entries.filter(entry =>
    selectedDepartment === 'all' || entry.employee?.department === selectedDepartment
  );

  const summary = {
    totalHours: displayedEntries.reduce((sum, e) => sum + e.totalHours, 0),
    totalLunchHours: displayedEntries.reduce((sum, e) => sum + e.lunchHours, 0),
    daysWorked: displayedEntries.filter(e => e.checkIn && e.checkOut).length,
    uniqueEmployees: new Set(displayedEntries.map(e => e.employee.id)).size
  };

  const entriesByDate = displayedEntries.reduce((acc, entry) => {
    if (!entry.date) return acc;
    const date = entry.date.split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, TimeEntry[]>);

  // Vacaciones aprobadas del mes: mapa por día (calendario) y por empleado+día (lista)
  const { byDate: vacationsByDate, byEmployeeDay: vacationsByEmployeeDay } = useMemo(
    () => buildVacationMaps(vacations, currentMonth.getFullYear(), currentMonth.getMonth() + 1, selectedEmployee, selectedDepartment, employees),
    [vacations, currentMonth, selectedEmployee, selectedDepartment, employees]
  );

  // Días de vacaciones sin fichaje se añaden a la lista para verlos junto a los marcajes.
  const vacationRows = useMemo(() => {
    const rows: TimeEntry[] = [];
    for (const [key, info] of vacationsByEmployeeDay) {
      const [employeeId, date] = key.split('|');
      const alreadyShown = displayedEntries.some((entry) => entry.employee.id === employeeId && entry.date.slice(0, 10) === date);
      if (alreadyShown) continue;
      rows.push({
        id: `vac-${key}`,
        date: `${date}T00:00:00.000Z`,
        checkIn: undefined,
        checkOut: undefined,
        lunchStart: undefined,
        lunchEnd: undefined,
        totalHours: 0,
        lunchHours: 0,
        isVacation: true,
        vacationReason: info.reason,
        employee: info.employee
      });
    }
    return rows;
  }, [vacationsByEmployeeDay, displayedEntries]);

  const allDisplayedRows = [...displayedEntries, ...vacationRows].sort((a, b) => b.date.localeCompare(a.date));

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const days = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-2 sm:p-3 bg-blue-600 rounded-xl text-white">
            <Clock size={22} className="sm:hidden" /><Clock size={28} className="hidden sm:block" />
          </div>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white">Control de Fichajes</h1>
            <p className="text-xs text-slate-500 hidden sm:block">Vista global de entradas y salidas</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
          {isAdmin && (
          <div className="w-full sm:flex-1 sm:min-w-[200px]">
            <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sm:mb-2">
              Departamento
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value);
                setSelectedEmployee('all');
              }}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
            >
              <option value="all">Todos los departamentos</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          )}

          {isAdmin && (
          <div className="w-full sm:flex-1 sm:min-w-[250px]">
            <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sm:mb-2">
              <User size={14} className="inline mr-1" />
              Empleado
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
            >
              <option value="all">Todos ({filteredEmployees.length})</option>
              {filteredEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          )}

          <div className="w-full sm:w-auto">
            <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sm:mb-2">
              <Calendar size={14} className="inline mr-1" />
              Mes
            </label>
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <button onClick={prevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors touch-active">
                <ChevronLeft size={18} />
              </button>
              <span className="px-2 sm:px-4 py-1 font-medium text-xs sm:text-sm min-w-[120px] sm:min-w-[150px] text-center capitalize">
                {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={nextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors touch-active">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="w-full sm:w-auto">
            <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sm:mb-2">Vista</label>
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium text-sm transition-colors ${viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Calendario
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium text-sm transition-colors ${viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Lista
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl">
          <div className="text-blue-600 dark:text-blue-400 text-xs sm:text-sm font-medium mb-1">Total Horas</div>
          <div className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white">{summary.totalHours.toFixed(1)}h</div>
        </div>
        <div className="p-4 sm:p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl">
          <div className="text-green-600 dark:text-green-400 text-xs sm:text-sm font-medium mb-1">Fichajes</div>
          <div className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white">{summary.daysWorked}</div>
        </div>
        <div className="p-4 sm:p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl">
          <div className="text-orange-600 dark:text-orange-400 text-xs sm:text-sm font-medium mb-1">Activos</div>
          <div className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white">{summary.uniqueEmployees}</div>
        </div>
        <div className="p-4 sm:p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl">
          <div className="text-purple-600 dark:text-purple-400 text-xs sm:text-sm font-medium mb-1">Promedio</div>
          <div className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {summary.daysWorked > 0 ? (summary.totalHours / summary.daysWorked).toFixed(1) : '0'}h
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-12 sm:p-20 text-center">
          <div className="animate-pulse text-slate-500">Cargando fichajes...</div>
        </div>
      ) : viewMode === 'calendar' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="p-3 sm:p-6">
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
                <div key={day} className="text-center font-bold text-slate-500 text-xs sm:text-sm py-1 sm:py-2">
                  {day}
                </div>
              ))}
              {days.map((day, idx) => {
                if (!day) return <div key={idx} className="aspect-square" />;

                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEntries = entriesByDate[dateKey] || [];
                const totalHours = dayEntries.reduce((sum, e) => sum + e.totalHours, 0);
                const vacationsOnDay = vacationsByDate.get(dateKey);

                return (
                  <div
                    key={idx}
                    className={`aspect-square border border-slate-100 dark:border-slate-800 rounded-lg p-1 sm:p-2 text-center ${dayEntries.length > 0 ? 'bg-blue-50 dark:bg-blue-900/20' : vacationsOnDay ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                    }`}
                  >
                    <div className="text-[10px] sm:text-xs font-medium text-slate-500">{day}</div>
                    {(dayEntries.length > 0 || vacationsOnDay) && (
                      <div className="mt-0.5 sm:mt-1">
                        {dayEntries.length > 0 && (
                          <>
                            <div className="text-[10px] sm:text-xs font-bold text-blue-600 dark:text-blue-400">
                              {dayEntries.length}p
                            </div>
                            <div className="text-[9px] sm:text-xs text-slate-600 dark:text-slate-400">
                              {totalHours.toFixed(1)}h
                            </div>
                          </>
                        )}
                        {vacationsOnDay && (
                          <div
                            className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
                            title={`Vacaciones: ${vacationsOnDay.names.join(', ')}`}
                          >
                            <Sun size={9} className="shrink-0" />
                            {vacationsOnDay.count}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Empleado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Entrada</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Salida</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pausa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {allDisplayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No hay fichajes registrados que coincidan con los filtros
                    </td>
                  </tr>
                ) : (
                  allDisplayedRows.map((entry) => (
                    <tr key={entry.id} className={`transition-colors ${entry.isVacation ? 'bg-emerald-50/80 dark:bg-emerald-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">{entry.employee.name}</div>
                        <div className="text-xs text-slate-500">{entry.employee.department}</div>
                        {entry.isVacation && (
                          <div
                            className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200"
                            title={entry.vacationReason ? `Vacaciones: ${entry.vacationReason}` : 'Vacaciones aprobadas'}
                          >
                            <Sun size={10} className="shrink-0" />
                            {entry.vacationReason ? `Vacaciones (${entry.vacationReason})` : 'Vacaciones'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{formatDate(entry.date)}</td>
                      <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400">{entry.isVacation ? '—' : formatTime(entry.checkIn)}</td>
                      <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{entry.isVacation ? '—' : formatTime(entry.checkOut)}</td>
                      <td className="px-4 py-3 text-sm">
                        {entry.isVacation ? '—' : (entry.lunchHours > 0 ? `${entry.lunchHours.toFixed(1)}h` : '-')}
                      </td>
                      <td className="px-4 py-3">
                        {entry.isVacation ? (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">0.00h</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              {entry.totalHours.toFixed(2)}h
                            </span>
                            {Number.isFinite(entry.lat) && Number.isFinite(entry.lng) && (
                              <button
                                onClick={() => handleViewMap(entry.lat, entry.lng)}
                                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors touch-active"
                                title="Ver ubicación"
                              >
                                <MapPin size={16} />
                              </button>
                            )}
                            {entry.employee?.id && entry.employee.id !== 'unknown' && (
                              <button
                                onClick={() => setObraModal({ employeeId: entry.employee.id, date: entry.date.split('T')[0], hours: entry.totalHours })}
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors touch-active"
                                title="Imputar horas de este día a una obra"
                              >
                                <HardHat size={16} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <LocationMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        location={mapLocation}
      />
      <ObraHoursModal
        open={obraModal !== null}
        onClose={() => setObraModal(null)}
        employeeId={obraModal?.employeeId || ''}
        date={obraModal?.date || ''}
        defaultHours={obraModal?.hours || 0}
      />
    </div>
  );
}
