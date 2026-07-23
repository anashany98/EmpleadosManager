import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { API_URL } from '../api/client';

interface NotificationItem {
    id: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
}

interface NotificationContextValue {
    unreadCount: number;
    notifications: NotificationItem[];
    markRead: (id: string) => void;
    markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function useNotifications(): NotificationContextValue {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
    return ctx;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markRead = useCallback((id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    useEffect(() => {
        if (!user) return;

        // F3: EventSource same-origin doesn't accept options — remove `as any` and options object
        const eventSource = new EventSource(`${API_URL}/notifications/stream`);
        let unmounting = false;

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'heartbeat') return;
                // Store notification in state so consumers can access it
                const item: NotificationItem = {
                    id: crypto.randomUUID(),
                    title: data.title || 'Notificación',
                    message: data.message || '',
                    read: false,
                    createdAt: new Date().toISOString()
                };
                setNotifications(prev => [item, ...prev].slice(0, 50));
            } catch {
                // ignore malformed data
            }
        };

        eventSource.addEventListener('INBOX_NEW_DOCUMENT', (event) => {
            try {
                const data = JSON.parse(event.data);
                const item: NotificationItem = {
                    id: crypto.randomUUID(),
                    title: data.title || 'Nuevo Documento',
                    message: data.message || '',
                    read: false,
                    createdAt: new Date().toISOString()
                };
                setNotifications(prev => [item, ...prev].slice(0, 50));
                toast.info(item.title, { description: item.message });
            } catch {
                // ignore
            }
        });

        eventSource.onerror = () => {
            if (unmounting) return;
            if (eventSource.readyState === EventSource.CLOSED) return;
            // Let native EventSource handle auto-reconnect
        };

        return () => {
            unmounting = true;
            eventSource.close();
        };
    }, [user]);

    return (
        <NotificationContext.Provider value={{ unreadCount, notifications, markRead, markAllRead }}>
            {children}
        </NotificationContext.Provider>
    );
}
