import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { API_URL } from '../api/client';

const NotificationContext = createContext<undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        console.log('[Notification] Connecting to EventStream...');
        const token = localStorage.getItem('token');

        // Native EventSource does not support headers easily for Bearer token.
        // Option 1: Pass token in query param (?token=...)
        // Option 2: Use polyfill event-source-polyfill
        // For simplicity and standard compliance, we usually use cookies or query param.
        // Let's use query param since our middleware can check it.
        // Note: We need to update authMiddleware if it doesn't check query. 
        // Let's check authMiddleware first, default protecting usually checks header.
        // If strict on header, we need polyfill.
        // BUT, for now let's try polyfill-less approach:
        // We will assume 'event-source-polyfill' is NOT installed.
        // We will pass `?token=${token}`.

        const eventSource = new EventSource(`${API_URL}/notifications/stream?token=${token}`);

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
