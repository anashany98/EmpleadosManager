import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { api } from '../../../api/client';
import { VacationCalendarView } from './VacationCalendarView';
import { VacationRequestCard } from './VacationRequestCard';
import type { VacationRequest } from './types';

type ManagementTab = 'CALENDAR' | 'MANAGE';

interface VacationManagementViewProps {
    isAdmin: boolean;
}

export function VacationManagementView({ isAdmin }: VacationManagementViewProps) {
    const [activeTab, setActiveTab] = useState<ManagementTab>(isAdmin ? 'CALENDAR' : 'MANAGE');
    const [pendingRequests, setPendingRequests] = useState<VacationRequest[]>([]);
    const [calendarVacations, setCalendarVacations] = useState<VacationRequest[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState('ALL');
    const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);

    const fetchDepartments = useCallback(async () => {
        try {
            const response = await api.get('/employees/departments');
            if (response.success) {
                setDepartments(response.data);
            }
        } catch (error) {
            console.error(error);
        }
    }, []);

    const fetchData = useCallback(async () => {
        try {
            if (activeTab === 'MANAGE') {
                const response = await api.get('/vacations/manage');
                if (response.success) {
                    setPendingRequests(response.data);
                }
                return;
            }

            const response = await api.get('/vacations');
            if (response.success) {
                setCalendarVacations(response.data);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar solicitudes');
        }
    }, [activeTab]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void fetchData();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [fetchData]);

    useEffect(() => {
        if (isAdmin && activeTab === 'CALENDAR') {
            const timer = window.setTimeout(() => {
                void fetchDepartments();
            }, 0);

            return () => window.clearTimeout(timer);
        }
    }, [activeTab, fetchDepartments, isAdmin]);

    const handleStatusUpdate = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
        try {
            await api.put(`/vacations/${requestId}/status`, { status });
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
                    onDepartmentChange={setSelectedDepartment}
                    onSelectRequest={setSelectedRequest}
                />
            ) : pendingRequests.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-12 rounded-[2rem] text-center border border-slate-200 dark:border-slate-800 border-dashed">
                    <Check size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-medium">No hay solicitudes pendientes de aprobacion.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {pendingRequests.map((request) => (
                        <VacationRequestCard
                            key={request.id}
                            request={request}
                            canManage={true}
                            onApprove={() => void handleStatusUpdate(request.id, 'APPROVED')}
                            onReject={() => void handleStatusUpdate(request.id, 'REJECTED')}
                        />
                    ))}
                </div>
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
                                    onApprove={() => void handleStatusUpdate(selectedRequest.id, 'APPROVED')}
                                    onReject={() => void handleStatusUpdate(selectedRequest.id, 'REJECTED')}
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
