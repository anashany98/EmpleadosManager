
import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { Bell, Check, X, Info, AlertTriangle, CheckCircle, AlertOctagon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Poll every 30s

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            clearInterval(interval);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

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
            await api.put(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error(error);
        }
    };

    const markAllRead = async () => {
        try {
            await api.put('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error(error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'SUCCESS': return <CheckCircle size={16} className="text-green-500" />;
            case 'WARNING': return <AlertTriangle size={16} className="text-amber-500" />;
            case 'ERROR': return <AlertOctagon size={16} className="text-red-500" />;
            default: return <Info size={16} className="text-blue-500" />;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
            >
                <Bell size={20} className="text-slate-600 dark:text-slate-300" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="absolute right-0 mt-2 w-80 max-h-[400px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col z-50 overflow-hidden"
                    >
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Notificaciones</h3>
                            {unreadCount > 0 && (
                                <button onClick={markAllRead} className="text-[10px] uppercase font-bold text-blue-600 hover:underline">
                                    Marcar leídas
                                </button>
                            )}
                        </div>

                        <div className="overflow-y-auto flex-1 p-2 space-y-1">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">
                                    No tienes notificaciones
                                </div>
                            ) : (
                                notifications.map(n => (
                                    <div
                                        key={n.id}
                                        className={`p-3 rounded-xl transition-colors flex gap-3 ${n.read ? 'opacity-60 hover:bg-slate-50 dark:hover:bg-slate-800' : 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
                                        onClick={() => markRead(n.id)}
                                    >
                                        <div className="mt-1 shrink-0">
                                            {getIcon(n.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{n.title}</p>
                                            <p className="text-xs text-slate-500 line-clamp-2">{n.message}</p>
                                            {n.link && (
                                                <Link to={n.link} className="text-[10px] text-blue-500 hover:underline mt-1 block font-medium">Ver detalle</Link>
                                            )}
                                        </div>
                                        {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />}
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
