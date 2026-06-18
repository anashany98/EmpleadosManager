import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

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

interface AlertsResponse {
    success: boolean;
    data: Alert[];
}

export function useAlerts() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAlerts = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get<AlertsResponse>('/alerts');
            if (res.success) {
                setAlerts(res.data);
                setUnreadCount(res.data.filter(a => !a.isRead).length);
            }
            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error loading alerts');
        } finally {
            setLoading(false);
        }
    }, []);

    const markAsRead = useCallback(async (id: string) => {
        try {
            await api.put(`/alerts/${id}/read`, {});
            setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch {
            // Silently fail
        }
    }, []);

    const dismiss = useCallback(async (id: string) => {
        try {
            await api.put(`/alerts/${id}/dismiss`, {});
            setAlerts(prev => prev.filter(a => a.id !== id));
            setUnreadCount(prev => {
                const alert = alerts.find(a => a.id === id);
                return alert && !alert.isRead ? Math.max(0, prev - 1) : prev;
            });
        } catch {
            // Silently fail
        }
    }, [alerts]);

    const markAllAsRead = useCallback(async () => {
        try {
            await api.put('/alerts/read-all', {});
            setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
            setUnreadCount(0);
        } catch {
            // Silently fail
        }
    }, []);

    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    return {
        alerts,
        unreadCount,
        loading,
        error,
        fetchAlerts,
        markAsRead,
        dismiss,
        markAllAsRead
    };
}
