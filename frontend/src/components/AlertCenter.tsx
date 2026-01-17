
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, X, Check, Clock, FileText, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';

interface Alert {
    id: string;
    type: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    message: string;
    actionUrl?: string;
    createdAt: string;
    isRead: boolean;
}

export default function AlertCenter() {
    const [isOpen, setIsOpen] = useState(false);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: alerts = [] } = useQuery({
        queryKey: ['alerts'],
        queryFn: () => api.get('/alerts'),
        refetchInterval: 60000 // Refetch every minute
    });

    const markReadMutation = useMutation({
        mutationFn: (id: string) => api.put(`/alerts/${id}/read`, {}),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] })
    });

    const dismissMutation = useMutation({
        mutationFn: (id: string) => api.put(`/alerts/${id}/dismiss`, {}),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] })
    });

    const unreadCount = alerts.filter((a: Alert) => !a.isRead).length;

    const handleAction = (alert: Alert) => {
        markReadMutation.mutate(alert.id);
        if (alert.actionUrl) {
            navigate(alert.actionUrl);
            setIsOpen(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'CONTRACT_EXPIRING': return <Clock className="text-amber-500" />;
            case 'DNI_EXPIRING': return <FileText className="text-blue-500" />;
            case 'LICENSE_EXPIRING': return <FileText className="text-purple-500" />;
            case 'TRIAL_PERIOD_ENDING': return <UserCheck className="text-green-500" />;
            case 'VACATION_QUOTA_LOW': return <Calendar className="text-orange-500" />;
            default: return <Info className="text-slate-500" />;
        }
    };

    // Helper components for icons that might not be imported yet
    const UserCheck = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></svg>;
    const Calendar = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>;

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
                <ShieldAlert size={20} className="text-slate-600 dark:text-slate-400" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                        {unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute right-0 mt-2 w-80 md:w-96 z-[100] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
                        >
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <h3 className="font-semibold text-slate-900 dark:text-white">Alertas del Sistema</h3>
                                <div className="text-xs text-slate-500">
                                    {unreadCount} nuevas
                                </div>
                            </div>

                            <div className="max-h-[70vh] overflow-y-auto">
                                {alerts.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                                        <ShieldAlert size={24} className="mx-auto mb-2 opacity-50" />
                                        <p>No tienes notificaciones</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {alerts.map((alert: Alert) => (
                                            <div
                                                key={alert.id}
                                                className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!alert.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                            >
                                                <div className="flex gap-3">
                                                    <div className="mt-1">
                                                        {getIcon(alert.type)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                                                                {alert.title}
                                                            </p>
                                                            <time className="text-xs text-slate-400 whitespace-nowrap">
                                                                {new Date(alert.createdAt).toLocaleDateString()}
                                                            </time>
                                                        </div>
                                                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">
                                                            {alert.message}
                                                        </p>

                                                        <div className="flex items-center gap-2 mt-2">
                                                            {alert.actionUrl && (
                                                                <button
                                                                    onClick={() => handleAction(alert)}
                                                                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                                                >
                                                                    Ver detalles
                                                                </button>
                                                            )}
                                                            <div className="flex-1" />
                                                            {!alert.isRead && (
                                                                <button
                                                                    onClick={() => markReadMutation.mutate(alert.id)}
                                                                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"
                                                                    title="Marcar como leída"
                                                                >
                                                                    <Check size={14} className="text-slate-500" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => dismissMutation.mutate(alert.id)}
                                                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"
                                                                title="Descartar"
                                                            >
                                                                <X size={14} className="text-slate-500" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
