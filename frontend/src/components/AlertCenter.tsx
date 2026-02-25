
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, X, Check, Clock, FileText, Info, Package, AlertCircle } from 'lucide-react';
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
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [focusedIndex, setFocusedIndex] = useState(-1);

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

    const markAllReadMutation = useMutation({
        mutationFn: () => api.put('/alerts/read-all', {}),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] })
    });

    const dismissAllMutation = useMutation({
        mutationFn: () => api.put('/alerts/dismiss-all', {}),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] })
    });

    const unreadCount = alerts.filter((a: Alert) => !a.isRead).length;

    // Handle click outside and keyboard
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                setIsOpen(false);
                buttonRef.current?.focus();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleAction = (alert: Alert) => {
        markReadMutation.mutate(alert.id);
        if (alert.actionUrl) {
            navigate(alert.actionUrl);
            setIsOpen(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'CONTRACT_EXPIRING': return <Clock className="text-amber-500" aria-hidden="true" />;
            case 'DNI_EXPIRING': return <FileText className="text-blue-500" aria-hidden="true" />;
            case 'LICENSE_EXPIRING': return <FileText className="text-purple-500" aria-hidden="true" />;
            case 'TRIAL_PERIOD_ENDING': return <UserCheck className="text-green-500" aria-hidden="true" />;
            case 'VACATION_QUOTA_LOW': return <Calendar className="text-orange-500" aria-hidden="true" />;
            case 'LOW_STOCK': return <Package className="text-red-500" aria-hidden="true" />;
            default: return <Info className="text-slate-500" aria-hidden="true" />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'CONTRACT_EXPIRING': return 'Contrato por vencer';
            case 'DNI_EXPIRING': return 'DNI por vencer';
            case 'LICENSE_EXPIRING': return 'Licencia por vencer';
            case 'TRIAL_PERIOD_ENDING': return 'Fin de período de prueba';
            case 'VACATION_QUOTA_LOW': return 'Cuota de vacaciones baja';
            case 'LOW_STOCK': return 'Stock bajo';
            default: return 'Información';
        }
    };

    const getSeverityLabel = (severity: string) => {
        switch (severity) {
            case 'HIGH': return 'Alta prioridad';
            case 'MEDIUM': return 'Prioridad media';
            case 'LOW': return 'Baja prioridad';
            default: return '';
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'HIGH': return 'border-l-red-500';
            case 'MEDIUM': return 'border-l-amber-500';
            case 'LOW': return 'border-l-blue-500';
            default: return 'border-l-slate-300';
        }
    };

    // Helper components for icons that might not be imported yet
    const UserCheck = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></svg>;
    const Calendar = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>;

    const handleMenuKeyDown = (e: React.KeyboardEvent) => {
        const items = alerts.length;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setFocusedIndex(prev => (prev + 1) % items);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setFocusedIndex(prev => (prev - 1 + items) % items);
                break;
            case 'Home':
                e.preventDefault();
                setFocusedIndex(0);
                break;
            case 'End':
                e.preventDefault();
                setFocusedIndex(items - 1);
                break;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                aria-label={`Alertas del sistema${unreadCount > 0 ? `, ${unreadCount} nuevas` : ''}`}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-controls="alert-dropdown"
                className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
            >
                <ShieldAlert size={20} className="text-slate-600 dark:text-slate-400" aria-hidden="true" />
                {unreadCount > 0 && (
                    <span 
                        className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900"
                        aria-hidden="true"
                    >
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Live region for screen readers */}
            <div 
                aria-live="polite" 
                aria-atomic="true" 
                className="sr-only"
            >
                {unreadCount > 0 && `Tienes ${unreadCount} alertas nuevas del sistema`}
            </div>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
                            onClick={() => setIsOpen(false)}
                            aria-hidden="true"
                        />
                        <motion.div
                            id="alert-dropdown"
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            role="menu"
                            aria-labelledby="alert-button"
                            onKeyDown={handleMenuKeyDown}
                            className="absolute right-0 mt-2 w-80 md:w-96 z-[100] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
                        >
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-slate-900 dark:text-white" id="alert-title">
                                        Alertas del Sistema
                                    </h3>
                                    {unreadCount > 0 && (
                                        <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">
                                            {unreadCount} nuevas
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {alerts.length > 0 && (
                                        <div className="flex items-center gap-2 border-l border-slate-100 dark:border-slate-800 pl-2">
                                            {unreadCount > 0 && (
                                                <button
                                                    onClick={() => markAllReadMutation.mutate()}
                                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1"
                                                    title="Marcar todas como leídas"
                                                    aria-label="Marcar todas las alertas como leídas"
                                                >
                                                    Leer Todo
                                                </button>
                                            )}
                                            <button
                                                onClick={() => dismissAllMutation.mutate()}
                                                className="text-[10px] font-bold text-rose-600 hover:text-rose-700 uppercase tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded px-1"
                                                title="Descartar todas"
                                                aria-label="Descartar todas las alertas"
                                            >
                                                Borrar Todo
                                            </button>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                        aria-label="Cerrar panel de alertas"
                                    >
                                        <X size={16} className="text-slate-400" />
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-[70vh] overflow-y-auto" role="listbox" aria-labelledby="alert-title">
                                {alerts.length === 0 ? (
                                    <div className="p-8 text-center" role="status">
                                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                            <Check size={24} className="text-green-500" aria-hidden="true" />
                                        </div>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium">Todo en orden</p>
                                        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">No hay alertas pendientes</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {alerts.map((alert: Alert, index: number) => (
                                            <div
                                                key={alert.id}
                                                role="menuitem"
                                                tabIndex={focusedIndex === index ? 0 : -1}
                                                className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 border-l-4 ${getSeverityColor(alert.severity)} ${!alert.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                                aria-label={`${alert.title}. ${alert.message}. ${getTypeLabel(alert.type)}. ${getSeverityLabel(alert.severity)}. ${alert.isRead ? 'Leída' : 'No leída'}`}
                                            >
                                                <div className="flex gap-3">
                                                    <div className="mt-1 shrink-0" aria-hidden="true">
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
                                                                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                                                                >
                                                                    Ver detalles
                                                                </button>
                                                            )}
                                                            <div className="flex-1" />
                                                            {!alert.isRead && (
                                                                <button
                                                                    onClick={() => markReadMutation.mutate(alert.id)}
                                                                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                                                    title="Marcar como leída"
                                                                    aria-label="Marcar esta alerta como leída"
                                                                >
                                                                    <Check size={14} className="text-slate-500" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => dismissMutation.mutate(alert.id)}
                                                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                                                title="Descartar"
                                                                aria-label="Descartar esta alerta"
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
