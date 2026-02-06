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

        eventSource.onerror = (err) => {
            console.error('[Notification] Stream Error', err);
            eventSource.close();
            // Auto reconnect logic is built-in to browser mostly, but if closed explicitly we might need to retry.
        };

        return () => {
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
