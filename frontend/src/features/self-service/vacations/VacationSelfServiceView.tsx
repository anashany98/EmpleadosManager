import { useCallback, useEffect, useMemo, useState } from 'react';
import { Paperclip, Plane, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { api } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';
import { SearchInput } from '../../../components/ui/SearchInput';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { VacationCalendarView } from './VacationCalendarView';
import { VacationRequestCard } from './VacationRequestCard';
import { ABSENCE_TYPES, type VacationBalanceSummary, type VacationRequest } from './types';
import { calculateVacationStats, createVacationRequest } from './utils';

type SelfViewTab = 'REQUESTS' | 'CALENDAR';

interface EmployeeVacationProfile {
    vacationDaysTotal?: number;
    vacationBalance?: VacationBalanceSummary | null;
}

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    return 'Error al crear solicitud';
};

export function VacationSelfServiceView() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<SelfViewTab>('REQUESTS');
    const [requests, setRequests] = useState<VacationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [type, setType] = useState('VACATION');
    const [reason, setReason] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [stats, setStats] = useState({ total: 30, used: 0, pending: 0, available: 30 });
    const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateError, setDateError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());

    const TYPES_REQUIRING_DOCUMENT = ['MARRIAGE', 'DEATH', 'MOVING', 'FAMILY_SICK', 'PUBLIC_DUTY'];

    const filteredRequests = useMemo(() => {
        if (!searchTerm) return requests;
        const lower = searchTerm.toLowerCase();
        return requests.filter((req) =>
            req.type.toLowerCase().includes(lower) ||
            req.status.toLowerCase().includes(lower) ||
            req.startDate.includes(lower) ||
            req.endDate.includes(lower)
        );
    }, [requests, searchTerm]);

    const fetchRequests = useCallback(async () => {
        if (!user?.employeeId) {
            setRequests([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const [employeeResponse, vacationsResponse] = await Promise.all([
                api.get(`/employees/${user.employeeId}`),
                api.get('/vacations/my-vacations')
            ]);

            const employee = (employeeResponse.data || employeeResponse) as EmployeeVacationProfile;
            const myVacations = vacationsResponse.data || vacationsResponse;
            const total = employee.vacationDaysTotal ?? 30;
            const summary = calculateVacationStats(myVacations, total, employee.vacationBalance);

            setRequests(myVacations);
            setStats(summary);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar tus vacaciones');
        } finally {
            setLoading(false);
        }
    }, [user?.employeeId]);

    useEffect(() => {
        void fetchRequests();
    }, [fetchRequests]);

    const handleCreate = async (event: React.FormEvent) => {
        event.preventDefault();

        // Validate dates
        if (startDate && endDate && endDate < startDate) {
            setDateError('La fecha de fin debe ser igual o posterior a la de inicio');
            return;
        }

        try {
            setCreating(true);
            await createVacationRequest({
                employeeId: user?.employeeId || '',
                startDate,
                endDate,
                type,
                reason,
                attachment
            });
            toast.success('Solicitud enviada');
            setShowModal(false);
            setStartDate('');
            setEndDate('');
            setReason('');
            setAttachment(null);
            await fetchRequests();
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setCreating(false);
        }
    };

    if (!user?.employeeId) {
        return (
            <div className="bg-white dark:bg-slate-950 rounded-[32px] border border-slate-100 dark:border-slate-900 shadow-xl p-8 text-slate-500">
                No tienes un perfil de empleado asociado para autoservicio.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">Mis vacaciones</h2>
                    <p className="text-slate-500 dark:text-slate-400">Portal de autoservicio para solicitudes y seguimiento.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <button
                            onClick={() => setActiveTab('REQUESTS')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'REQUESTS' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                        >
                            Solicitudes
                        </button>
                        <button
                            onClick={() => setActiveTab('CALENDAR')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'CALENDAR' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                        >
                            Mi calendario
                        </button>
                    </div>

                    <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30">
                        <Plane size={18} />
                        Nueva solicitud
                    </button>
                </div>
            </div>

{activeTab === 'REQUESTS' && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Plane size={40} /></div>
                            <div className="text-sm font-medium text-slate-500 mb-1">Dias disponibles</div>
                            <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{stats.available}</div>
                            <div className="text-xs text-slate-400 mt-2">De un total de {stats.total}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <div className="text-sm font-medium text-slate-500 mb-1">Dias disfrutados</div>
                            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{stats.used}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <div className="text-sm font-medium text-slate-500 mb-1">Dias pendientes</div>
                            <div className="text-3xl font-black text-amber-500">{stats.pending}</div>
                            <div className="text-xs text-slate-400 mt-2">Esperando aprobacion</div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="bg-white dark:bg-slate-900 p-12 rounded-[2rem] text-center border border-slate-200 dark:border-slate-800 border-dashed">
                            <LoadingSpinner text="Cargando solicitudes..." />
                        </div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 p-12 rounded-[2rem] text-center border border-slate-200 dark:border-slate-800 border-dashed">
                            <Plane size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-500 font-medium">No tienes solicitudes registradas.</p>
                        </div>
                    ) : (
                        <>
                            <SearchInput
                                value={searchTerm}
                                onChange={setSearchTerm}
                                placeholder="Buscar solicitudes..."
                                className="mb-4 max-w-md"
                            />
                            <div className="grid grid-cols-1 gap-4">
                                {filteredRequests.map((request) => (
                                    <VacationRequestCard
                                        key={request.id}
                                        request={request}
                                        canManage={false}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}

{activeTab === 'CALENDAR' && (
                <VacationCalendarView
                    vacations={requests}
                    title="Mi calendario"
                    scopeLabel="Vista de tus ausencias aprobadas y pendientes."
                    onSelectRequest={setSelectedRequest}
                    currentDate={currentDate}
                    onCurrentDateChange={setCurrentDate}
                />
            )}

            <AnimatePresence>
                {showModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">Nueva solicitud</h3>
                                <button onClick={() => setShowModal(false)}>
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>
                            <form onSubmit={handleCreate} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Desde</label>
                                        <input
                                            type="date"
                                            required
                                            value={startDate}
                                            onChange={(inputEvent) => {
                                                setStartDate(inputEvent.target.value);
                                                setDateError(null);
                                            }}
                                            className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Hasta</label>
                                        <input
                                            type="date"
                                            required
                                            value={endDate}
                                            onChange={(inputEvent) => {
                                                setEndDate(inputEvent.target.value);
                                                setDateError(null);
                                            }}
                                            onBlur={() => {
                                                if (endDate && startDate && endDate < startDate) {
                                                    setDateError('La fecha de fin debe ser igual o posterior a la de inicio');
                                                }
                                            }}
                                            className={`w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium ${dateError ? 'ring-2 ring-red-500/50' : ''}`}
                                        />
                                    </div>
                                </div>
                                {dateError && (
                                    <p className="text-red-500 text-sm">{dateError}</p>
                                )}

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {Object.entries(ABSENCE_TYPES).map(([key, config]) => (
                                            <button type="button" key={key} onClick={() => setType(key)} className={`p-2 rounded-xl border text-xs font-bold transition-all ${type === key ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                                {config.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Motivo</label>
                                    <textarea value={reason} onChange={(inputEvent) => setReason(inputEvent.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium h-24 resize-none" placeholder="Opcional..." />
                                </div>

                                {TYPES_REQUIRING_DOCUMENT.includes(type) && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Adjunto</label>
                                        <div className="relative">
                                            <input
                                                type="file"
                                                onChange={(inputEvent) => setAttachment(inputEvent.target.files?.[0] || null)}
                                                className="hidden"
                                                id="vacation-attachment"
                                            />
                                            <label
                                                htmlFor="vacation-attachment"
                                                className="flex items-center gap-2 w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 transition-colors cursor-pointer"
                                            >
                                                <Paperclip size={18} className="text-slate-400" />
                                                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                                    {attachment ? attachment.name : 'Seleccionar archivo...'}
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                    )}

                                <div className="pt-2">
                                    <button type="submit" disabled={creating} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                        Enviar solicitud
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}

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
                                <VacationRequestCard request={selectedRequest} canManage={false} />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
