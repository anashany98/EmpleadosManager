import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plane, Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { hasModuleAccess, normalizeActor } from '@shared/authz';
import { api } from '../../../api/client';
import { useConfirm } from '../../../context/ConfirmContext';
import { useAuth } from '../../../contexts/AuthContext';
import { VacationCalendarView } from './VacationCalendarView';
import { VacationRequestCard } from './VacationRequestCard';
import { type VacationBalanceSummary, type VacationRequest } from './types';
import { calculateVacationStats, createVacationRequest } from './utils';
import { useAbsenceTypeCatalog } from './useAbsenceTypeCatalog';
import { notifyAbsenceUpdated } from './absenceEvents';

type WorkspaceTab = 'REQUESTS' | 'CALENDAR';

export type WorkspaceMode = 'vacation' | 'absence';

interface EmployeeVacationWorkspaceProps {
    employeeId: string;
    /**
     * `vacation` → solo solicitudes de tipo VACATION. El modal "Nueva
     * ausencia" ofrece únicamente ese tipo.
     * `absence` → todo lo que NO sea VACATION (bajas, maternidad,
     * permisos, citas médicas, etc.).
     */
    mode?: WorkspaceMode;
}

interface EmployeeVacationSummary {
    firstName?: string;
    lastName?: string;
    vacationDaysTotal?: number;
    vacationBalance?: VacationBalanceSummary | null;
    department?: string | null;
}

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        try {
            const parsed = JSON.parse(error.message) as { message?: string };
            return parsed.message || error.message;
        } catch {
            return error.message;
        }
    }

    return 'Error al procesar la solicitud';
};

export function EmployeeVacationWorkspace({ employeeId, mode = 'vacation' }: EmployeeVacationWorkspaceProps) {
    const { user } = useAuth();
    const confirmAction = useConfirm();
    const actor = useMemo(() => normalizeActor(user), [user]);
    const canManageRequests = Boolean(actor && actor.role !== 'employee' && hasModuleAccess(actor, 'vacations', 'write'));
    const { catalog: absenceTypes, activeCatalog } = useAbsenceTypeCatalog();

    // Tipos de ausencia que el workspace maneja en este modo:
    //  - 'vacation'  → solo VACATION
    //  - 'absence'   → todos los tipos definidos en ABSENCE_TYPES
    //                   excepto VACATION
    const availableTypes = useMemo(() => {
        return Object.keys(activeCatalog).filter((key) => (mode === 'vacation' ? key === 'VACATION' : key !== 'VACATION'));
    }, [activeCatalog, mode]);

    const [activeTab, setActiveTab] = useState<WorkspaceTab>('REQUESTS');
    const [requests, setRequests] = useState<VacationRequest[]>([]);
    const [employee, setEmployee] = useState<EmployeeVacationSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);
    const [editingRequest, setEditingRequest] = useState<VacationRequest | null>(null);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [type, setType] = useState<string>(mode === 'vacation' ? 'VACATION' : (availableTypes[0] ?? 'OTHER'));
    const [reason, setReason] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [employeeResponse, vacationsResponse] = await Promise.all([
                api.get(`/employees/${employeeId}`),
                api.get(`/vacations/employee/${employeeId}`)
            ]);

            const employeePayload = employeeResponse.data || employeeResponse;
            const employeeFullName = `${employeePayload.firstName || ''} ${employeePayload.lastName || ''}`.trim() || 'Empleado';
            const vacationsPayload = (vacationsResponse.data || vacationsResponse || []) as VacationRequest[];

            setEmployee(employeePayload);
            setRequests(vacationsPayload.map((request) => ({
                ...request,
                employee: request.employee || {
                    name: employeeFullName,
                    department: employeePayload.department || undefined
                }
            })));
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar vacaciones del empleado');
        } finally {
            setLoading(false);
        }
    }, [employeeId]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const employeeName = `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || 'Empleado';

    // Filtramos las solicitudes en cliente según el modo. En el backend
    // ya se devuelven TODAS las ausencias del empleado; aquí decidimos
    // cuáles enseña cada tab. Las KPIs/balance siguen calculándose con
    // TODAS las solicitudes — la pestaña Vacaciones es la que tiene la
    // tarjeta de balance, Ausencias no.
    const visibleRequests = useMemo(
        () => requests.filter((request) => availableTypes.includes(request.type)),
        [requests, availableTypes]
    );
    const stats = calculateVacationStats(visibleRequests, employee?.vacationDaysTotal ?? 30, employee?.vacationBalance);

    const resetForm = () => {
        setStartDate('');
        setEndDate('');
        setType(mode === 'vacation' ? 'VACATION' : (availableTypes[0] ?? 'OTHER'));
        setReason('');
        setAttachment(null);
        setEditingRequest(null);
    };

    const openCreateModal = () => {
        resetForm();
        setShowModal(true);
    };

    const openEditModal = (request: VacationRequest) => {
        setEditingRequest(request);
        setStartDate(request.startDate.slice(0, 10));
        setEndDate(request.endDate.slice(0, 10));
        setType(request.type);
        setReason(request.reason || '');
        setAttachment(null);
        setSelectedRequest(null);
        setShowModal(true);
    };

    const handleCreate = async (event: React.FormEvent) => {
        event.preventDefault();
        setSubmitting(true);

        try {
            if (editingRequest) {
                await api.put(`/vacations/${editingRequest.id}`, { startDate, endDate, type, reason });
                toast.success('Ausencia actualizada');
            } else {
                await createVacationRequest({
                    employeeId,
                    startDate,
                    endDate,
                    type,
                    reason,
                    attachment
                });
                toast.success('Solicitud registrada');
            }
            setShowModal(false);
            resetForm();
            await fetchData();
            notifyAbsenceUpdated({
                employeeId,
                requestId: editingRequest?.id,
                action: editingRequest ? 'UPDATED' : 'CREATED'
            });
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (request: VacationRequest) => {
        const confirmed = await confirmAction({
            title: 'Eliminar ausencia',
            message: `Se eliminará la solicitud del ${new Date(request.startDate).toLocaleDateString('es-ES')} al ${new Date(request.endDate).toLocaleDateString('es-ES')}.`,
            confirmText: 'Eliminar',
            cancelText: 'Cancelar',
            type: 'danger'
        });

        if (!confirmed) {
            return;
        }

        try {
            await api.delete(`/vacations/${request.id}`);
            toast.success('Ausencia eliminada');
            if (selectedRequest?.id === request.id) {
                setSelectedRequest(null);
            }
            await fetchData();
            notifyAbsenceUpdated({
                employeeId,
                requestId: request.id,
                action: 'DELETED'
            });
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleStatusUpdate = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
        try {
            await api.put(`/vacations/${requestId}/status`, { status });
            toast.success(`Solicitud ${status === 'APPROVED' ? 'aprobada' : 'rechazada'}`);

            if (selectedRequest?.id === requestId) {
                setSelectedRequest({ ...selectedRequest, status });
            }

            await fetchData();
            notifyAbsenceUpdated({
                employeeId,
                requestId,
                action: 'STATUS_CHANGED'
            });
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const isVacationMode = mode === 'vacation';
    const heading = isVacationMode ? 'Vacaciones' : 'Ausencias';
    const headingSubtitle = isVacationMode
        ? `Gestión individual de ${employeeName}. Comparte el mismo flujo operativo del portal de vacaciones.`
        : `Gestión individual de ${employeeName} para el resto de ausencias (bajas, permisos, citas médicas, etc.). Las vacaciones se gestionan en su pestaña.`;
    const newAbsenceLabel = isVacationMode ? 'Nueva ausencia' : 'Nueva ausencia';

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">{heading}</h2>
                    <p className="text-slate-500 dark:text-slate-400">
                        {headingSubtitle}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
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
                            Calendario
                        </button>
                    </div>

                    {canManageRequests && (
                        <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30">
                            <Plus size={18} />
                            Nueva ausencia
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="text-sm font-medium text-slate-500 mb-1">Días disponibles</div>
                    <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{stats.available}</div>
                    <div className="text-xs text-slate-400 mt-2">De un total de {stats.total}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="text-sm font-medium text-slate-500 mb-1">Días aprobados</div>
                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{stats.used}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="text-sm font-medium text-slate-500 mb-1">Días pendientes</div>
                    <div className="text-3xl font-black text-amber-500">{stats.pending}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="text-sm font-medium text-slate-500 mb-1">Estado operativo</div>
                    <div className="flex items-center gap-2 mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <CheckCircle2 size={18} className="text-emerald-500" />
                        Flujo compartido activo
                    </div>
                </div>
            </div>

            {activeTab === 'REQUESTS' && (
                loading ? (
                    <div className="bg-white dark:bg-slate-900 p-12 rounded-[2rem] text-center border border-slate-200 dark:border-slate-800 border-dashed text-slate-500">
                        Cargando solicitudes...
                    </div>
                ) : visibleRequests.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 p-12 rounded-[2rem] text-center border border-slate-200 dark:border-slate-800 border-dashed">
                        <Plane size={48} className="mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500 font-medium">
                            {isVacationMode
                                ? 'No hay vacaciones registradas para este empleado.'
                                : 'No hay ausencias registradas para este empleado.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {visibleRequests.map((request) => (
                            <VacationRequestCard
                                key={request.id}
                                request={request}
                                canManage={canManageRequests}
                                onApprove={canManageRequests ? () => void handleStatusUpdate(request.id, 'APPROVED') : undefined}
                                onReject={canManageRequests ? () => void handleStatusUpdate(request.id, 'REJECTED') : undefined}
                                onDelete={canManageRequests ? () => void handleDelete(request) : undefined}
                                onEdit={canManageRequests ? () => openEditModal(request) : undefined}
                                absenceTypes={absenceTypes}
                            />
                        ))}
                    </div>
                )
            )}

            {activeTab === 'CALENDAR' && (
                <VacationCalendarView
                    vacations={visibleRequests}
                    title="Calendario del empleado"
                    scopeLabel="Vista mensual con ausencias aprobadas, pendientes y rechazadas."
                    onSelectRequest={setSelectedRequest}
                    absenceTypes={absenceTypes}
                />
            )}

            <AnimatePresence>
                {selectedRequest && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">Detalle de ausencia</h3>
                                <button onClick={() => setSelectedRequest(null)}>
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="p-6">
                                <VacationRequestCard
                                    request={selectedRequest}
                                    canManage={canManageRequests}
                                    onApprove={canManageRequests ? () => void handleStatusUpdate(selectedRequest.id, 'APPROVED') : undefined}
                                    onReject={canManageRequests ? () => void handleStatusUpdate(selectedRequest.id, 'REJECTED') : undefined}
                                    onDelete={canManageRequests ? () => void handleDelete(selectedRequest) : undefined}
                                    onEdit={canManageRequests ? () => openEditModal(selectedRequest) : undefined}
                                    absenceTypes={absenceTypes}
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">{editingRequest ? 'Modificar ausencia' : 'Nueva ausencia'}</h3>
                                <button onClick={() => { setShowModal(false); resetForm(); }}>
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>
                            <form onSubmit={handleCreate} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Desde</label>
                                        <input type="date" required value={startDate} onChange={(inputEvent) => setStartDate(inputEvent.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Hasta</label>
                                        <input type="date" required value={endDate} onChange={(inputEvent) => setEndDate(inputEvent.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium" />
                                    </div>
                                </div>

                                {!editingRequest && <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                                    <div className={`grid ${availableTypes.length > 6 ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                                        {availableTypes.map((key) => {
                                            const config = activeCatalog[key];
                                            if (!config) return null;
                                            return (
                                                <button type="button" key={key} onClick={() => setType(key)} className={`p-2 rounded-xl border text-xs font-bold transition-all ${type === key ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                                    {config.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>}

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Motivo</label>
                                    <textarea value={reason} onChange={(inputEvent) => setReason(inputEvent.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium h-24 resize-none" placeholder="Opcional..." />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Adjunto</label>
                                    <input
                                        type="file"
                                        onChange={(inputEvent) => setAttachment(inputEvent.target.files?.[0] || null)}
                                        className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700 text-sm"
                                    />
                                </div>

                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Las ausencias creadas aquí siguen el mismo flujo de aprobación del portal de vacaciones.
                                </p>

                                <div className="pt-2">
                                    <button type="submit" disabled={submitting} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-indigo-500/20">
                                        {editingRequest ? 'Guardar modificación' : 'Registrar ausencia'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
