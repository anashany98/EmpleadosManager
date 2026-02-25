
import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { Bell, Info, AlertTriangle, CheckCircle, AlertOctagon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [focusedIndex, setFocusedIndex] = useState(-1);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Poll every 30s

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
            clearInterval(interval);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/notifications');
            if (res.success) {
                setNotifications(res.data.notifications);
                setUnreadCount(res.data.unreadCount);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const markRead = async (id: string) => {
        try {
            await api.put(`/notifications/${id}/read`, {});
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error(error);
        }
    };

    const markAllRead = async () => {
        try {
            await api.put('/notifications/read-all', {});
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error(error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'SUCCESS': return <CheckCircle size={16} className="text-green-500" aria-hidden="true" />;
            case 'WARNING': return <AlertTriangle size={16} className="text-amber-500" aria-hidden="true" />;
            case 'ERROR': return <AlertOctagon size={16} className="text-red-500" aria-hidden="true" />;
            default: return <Info size={16} className="text-blue-500" aria-hidden="true" />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'SUCCESS': return 'Éxito';
            case 'WARNING': return 'Advertencia';
            case 'ERROR': return 'Error';
            default: return 'Información';
        }
    };

    const handleMenuKeyDown = (e: React.KeyboardEvent) => {
        const items = notifications.length;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setFocusedIndex(prev => (prev + 1) % items);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setFocusedIndex(prev => (prev - 1 + items) % items);
                break;
            case 'Enter':
            case ' ':
                if (focusedIndex >= 0 && focusedIndex < notifications.length) {
                    e.preventDefault();
                    markRead(notifications[focusedIndex].id);
                }
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
                aria-label={`Notificaciones${unreadCount > 0 ? `, ${unreadCount} sin leer` : ''}`}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-controls="notification-dropdown"
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
            >
                <Bell size={20} className="text-slate-600 dark:text-slate-300" aria-hidden="true" />
                {unreadCount > 0 && (
                    <span 
                        className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"
                        aria-hidden="true"
                    />
                )}
            </button>

            {/* Live region for screen readers */}
            <div 
                aria-live="polite" 
                aria-atomic="true" 
                className="sr-only"
            >
                {unreadCount > 0 && `Tienes ${unreadCount} notificaciones sin leer`}
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        id="notification-dropdown"
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        role="menu"
                        aria-labelledby="notification-button"
                        onKeyDown={handleMenuKeyDown}
                        className="absolute right-0 mt-2 w-80 max-h-[400px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col z-50 overflow-hidden"
                    >
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white" id="notification-title">
                                Notificaciones
                            </h3>
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button 
                                        onClick={markAllRead} 
                                        className="text-[10px] uppercase font-bold text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1"
                                        aria-label="Marcar todas las notificaciones como leídas"
                                    >
                                        Marcar leídas
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    aria-label="Cerrar panel de notificaciones"
                                >
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                        </div>

                        <div className="overflow-y-auto flex-1 p-2 space-y-1" role="listbox" aria-labelledby="notification-title">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center" role="status">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <Bell size={24} className="text-slate-400" aria-hidden="true" />
                                    </div>
                                    <p className="text-slate-400 text-sm font-medium">No tienes notificaciones</p>
                                    <p className="text-slate-400 text-xs mt-1">Las alertas importantes aparecerán aquí</p>
                                </div>
                            ) : (
                                notifications.map((n, index) => (
                                    <div
                                        key={n.id}
                                        role="menuitem"
                                        tabIndex={focusedIndex === index ? 0 : -1}
                                        className={`p-3 rounded-xl transition-colors flex gap-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                            n.read 
                                                ? 'opacity-60 hover:bg-slate-50 dark:hover:bg-slate-800' 
                                                : 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                        }`}
                                        onClick={() => markRead(n.id)}
                                        aria-label={`${n.title}. ${n.message}. ${getTypeLabel(n.type)}. ${n.read ? 'Leída' : 'No leída'}`}
                                    >
                                        <div className="mt-1 shrink-0" aria-hidden="true">
                                            {getIcon(n.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                {n.title}
                                            </p>
                                            <p className="text-xs text-slate-500 line-clamp-2">{n.message}</p>
                                            {n.link && (
                                                <Link 
                                                    to={n.link} 
                                                    className="text-[10px] text-blue-500 hover:underline mt-1 block font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markRead(n.id);
                                                        setIsOpen(false);
                                                    }}
                                                >
                                                    Ver detalle
                                                </Link>
                                            )}
                                        </div>
                                        {!n.read && (
                                            <div 
                                                className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" 
                                                aria-label="No leída"
                                            />
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
