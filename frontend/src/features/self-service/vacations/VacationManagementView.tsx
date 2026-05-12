import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Check, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { api } from '../../../api/client';
import { SearchInput } from '../../../components/ui/SearchInput';
import { VacationCalendarView } from './VacationCalendarView';
import { VacationRequestCard } from './VacationRequestCard';
import type { VacationRequest } from './types';

type ManagementTab = 'CALENDAR' | 'MANAGE' | 'METRICS';

interface DepartmentUsage {
    department: string;
    totalRequestedDays: number;
    totalApprovedDays: number;
    totalRejectedDays: number;
    employeeCount: number;
    avgDaysPerEmployee: number;
}

interface VacationManagementViewProps {
    isAdmin: boolean;
}

export function VacationManagementView({ isAdmin }: VacationManagementViewProps) {
    const [activeTab, setActiveTab] = useState<ManagementTab>(isAdmin ? 'CALENDAR' : 'MANAGE');
    const [pendingRequests, setPendingRequests] = useState<VacationRequest[]>([]);
    const [calendarVacations, setCalendarVacations] = useState<VacationRequest[]>([]);
    const [calendarCurrentDate, setCalendarCurrentDate] = useState(new Date());
    const [departments, setDepartments] = useState<string[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('vacationDeptFilter') ?? 'ALL';
        }
        return 'ALL';
    });
    const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);
    const [metricsYear, setMetricsYear] = useState(new Date().getFullYear());
    const [departmentUsage, setDepartmentUsage] = useState<DepartmentUsage[]>([]);
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
    const [managePage, setManagePage] = useState(1);
    const [manageLimit] = useState(20);
    const [manageMeta, setManageMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });

    const fetchDepartments = useCallback(async () => {
        try {
            const response = await api.get('/employees/departments');
            if (response.success) {
                setDepartments(response.data);
            }
        } catch (error) {
            toast.error('Error al cargar departamentos');
        }
    }, []);

    const fetchMetrics = useCallback(async () => {
        if (!isAdmin) return;
        setIsLoadingMetrics(true);
        try {
            const response = await api.get('/reports/vacations/usage-by-department', { params: { year: metricsYear } });
            if (response.success) {
                setDepartmentUsage(response.data);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar métricas');
        } finally {
            setIsLoadingMetrics(false);
        }
    }, [metricsYear, isAdmin]);

    const fetchData = useCallback(async () => {
        try {
            if (activeTab === 'MANAGE') {
                const response = await api.get('/vacations/manage', { params: { page: managePage, limit: manageLimit } });
                if (response.success) {
                    const payload = response.data?.data ? response.data : { data: response.data, meta: { total: Array.isArray(response.data) ? response.data.length : 0, page: managePage, limit: manageLimit, totalPages: 1 } };
                    setPendingRequests(Array.isArray(payload.data) ? payload.data : []);
                    if (payload.meta) setManageMeta(payload.meta);
                }
                return;
            }

            const year = calendarCurrentDate.getFullYear();
            const month = calendarCurrentDate.getMonth() + 1;
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

            const response = await api.get('/vacations', { params: { startDate, endDate } });
            if (response.success) {
                setCalendarVacations(response.data);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar solicitudes');
        } finally {
            if (activeTab === 'CALENDAR') {
                setIsLoadingCalendar(false);
            }
        }
    }, [activeTab, calendarCurrentDate, managePage]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void fetchData();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [fetchData]);

    useEffect(() => {
        if (activeTab === 'CALENDAR') {
            setIsLoadingCalendar(true);
            const timer = window.setTimeout(() => {
                void fetchData();
            }, 0);
            return () => window.clearTimeout(timer);
        }
    }, [activeTab, calendarCurrentDate, fetchData]);

    useEffect(() => {
        if (isAdmin && activeTab === 'CALENDAR') {
            const timer = window.setTimeout(() => {
                void fetchDepartments();
            }, 0);

            return () => window.clearTimeout(timer);
        }
    }, [activeTab, fetchDepartments, isAdmin]);

    useEffect(() => {
        if (isAdmin && activeTab === 'METRICS') {
            const timer = window.setTimeout(() => {
                void fetchMetrics();
            }, 0);

            return () => window.clearTimeout(timer);
        }
    }, [activeTab, fetchMetrics, isAdmin]);

    const handleDepartmentChange = (dept: string) => {
        setSelectedDepartment(dept);
        localStorage.setItem('vacationDeptFilter', dept);
    };

    const handleStatusUpdate = async (requestId: string, status: 'APPROVED' | 'REJECTED', comment?: string) => {
        try {
            const payload: { status: string; rejectionReason?: string; managerComment?: string } = { status };
            if (status === 'REJECTED' && comment) {
                payload.rejectionReason = comment;
            }
            if (status === 'APPROVED' && comment) {
                payload.managerComment = comment;
            }
            await api.put(`/vacations/${requestId}/status`, payload);
            toast.success(`Solicitud ${status === 'APPROVED' ? 'aprobada' : 'rechazada'}`);
            await fetchData();

            if (selectedRequest?.id === requestId) {
                setSelectedRequest({ ...selectedRequest, status });
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar estado');
        }
    };

    const filteredCalendarVacations = useMemo(() => {
        if (selectedDepartment === 'ALL') {
            return calendarVacations;
        }

        return calendarVacations.filter((vacation) => vacation.employee?.department === selectedDepartment);
    }, [calendarVacations, selectedDepartment]);

    const filteredRequests = useMemo(() => {
        if (!searchTerm) return pendingRequests;
        const lower = searchTerm.toLowerCase();
        return pendingRequests.filter((req) =>
            req.employee?.firstName?.toLowerCase().includes(lower) ||
            req.employee?.lastName?.toLowerCase().includes(lower) ||
            req.type.toLowerCase().includes(lower) ||
            req.status.toLowerCase().includes(lower)
        );
    }, [pendingRequests, searchTerm]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">Backoffice de ausencias</h2>
                    <p className="text-slate-500 dark:text-slate-400">Aprobacion, calendario global y supervision operativa.</p>
                </div>

                <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <button
                        onClick={() => setActiveTab('CALENDAR')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'CALENDAR' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                    >
                        Calendario global
                    </button>
                    <button
                        onClick={() => setActiveTab('MANAGE')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'MANAGE' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                    >
                        Solicitudes pendientes
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => setActiveTab('METRICS')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'METRICS' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                        >
                            Metricas
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'CALENDAR' ? (
                <VacationCalendarView
                    vacations={filteredCalendarVacations}
                    title="Calendario global"
                    scopeLabel={isAdmin ? 'Vista global filtrable por departamento.' : 'Vista del equipo para coordinacion operativa.'}
                    showDepartmentFilter={isAdmin}
                    departments={departments}
                    selectedDepartment={selectedDepartment}
                    onDepartmentChange={handleDepartmentChange}
                    onSelectRequest={setSelectedRequest}
                    isLoading={isLoadingCalendar}
                    currentDate={calendarCurrentDate}
                    onCurrentDateChange={setCalendarCurrentDate}
                />
            ) : activeTab === 'METRICS' ? (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">Uso de vacaciones por departamento</h3>
                        <select
                            value={metricsYear}
                            onChange={(e) => setMetricsYear(Number(e.target.value))}
                            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((year) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                    {isLoadingMetrics ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : departmentUsage.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <p>No hay datos de vacaciones para el ano seleccionado.</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={departmentUsage} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="department"
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={60}
                                />
                                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="totalRequestedDays" name="Dias solicitados" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="totalApprovedDays" name="Dias aprobados" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="totalRejectedDays" name="Dias rechazados" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                    {!isLoadingMetrics && departmentUsage.length > 0 && (
                        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                            {departmentUsage.map((dept) => (
                                <div key={dept.department} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{dept.department}</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">{dept.avgDaysPerEmployee}</p>
                                    <p className="text-xs text-slate-400">promedio dias/empleado</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : pendingRequests.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-12 rounded-[2rem] text-center border border-slate-200 dark:border-slate-800 border-dashed">
                    <Check size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-medium">No hay solicitudes pendientes de aprobacion.</p>
                </div>
            ) : (
                <>
                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Buscar por empleado o tipo..."
                        className="mb-4 max-w-md"
                    />
                    <div className="grid grid-cols-1 gap-4">
                        {filteredRequests.map((request) => (
                        <VacationRequestCard
                            key={request.id}
                            request={request}
                            canManage={true}
                            onApprove={(comment) => void handleStatusUpdate(request.id, 'APPROVED', comment)}
                            onReject={(comment) => void handleStatusUpdate(request.id, 'REJECTED', comment)}
                        />
                    ))}
                    </div>
                    <div className="flex items-center justify-between px-2">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            {manageMeta.total} solicitudes en total
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setManagePage(p => Math.max(1, p - 1))}
                                disabled={manageMeta.page <= 1}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Anterior
                            </button>
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                Página {manageMeta.page} de {manageMeta.totalPages || 1}
                            </span>
                            <button
                                onClick={() => setManagePage(p => Math.min(manageMeta.totalPages, p + 1))}
                                disabled={manageMeta.page >= manageMeta.totalPages}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                </>
            )}

            <AnimatePresence>
                {selectedRequest && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">Detalle de solicitud</h3>
                                <button onClick={() => setSelectedRequest(null)}>
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="p-6">
                                <VacationRequestCard
                                    request={selectedRequest}
                                    canManage={selectedRequest.status === 'PENDING'}
                                    onApprove={(comment) => void handleStatusUpdate(selectedRequest.id, 'APPROVED', comment)}
                                    onReject={(comment) => void handleStatusUpdate(selectedRequest.id, 'REJECTED', comment)}
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
