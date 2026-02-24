import { createContext, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { API_URL } from '../api/client';

const NotificationContext = createContext<undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        console.log('[Notification] Connecting to EventStream...');
        const eventSource = new EventSource(`${API_URL}/notifications/stream`, { withCredentials: true } as any);
        let unmounting = false;

        eventSource.onopen = () => {
            console.log('[Notification] Connected.');
        };

        eventSource.onmessage = (event) => {
            try {
                // Heartbeat or simple data
                const data = JSON.parse(event.data);
                console.log('[Notification] Heartbeat:', data);
            } catch {
                // ignore
            }
        };

        eventSource.addEventListener('INBOX_NEW_DOCUMENT', (event) => {
            try {
                const data = JSON.parse(event.data);
                toast.info(data.title || 'Nuevo Documento', {
                    description: data.message
                });
            } catch (e) {
                console.error('Error parsing notification', e);
            }
        });

        eventSource.onerror = () => {
            // Let native EventSource handle reconnect attempts.
            // Closing here prevents recovery after transient network/proxy issues.
            if (unmounting) return;
            if (eventSource.readyState === EventSource.CLOSED) return;
            console.warn('[Notification] Stream disconnected, waiting for auto-reconnect');
        };

        return () => {
            unmounting = true;
            console.log('[Notification] Closing...');
            eventSource.close();
        };
    }, [user]);

    return (
        <NotificationContext.Provider value={undefined}>
            {children}
        </NotificationContext.Provider>
    );
}
