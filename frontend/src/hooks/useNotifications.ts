import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    link?: string;
    read: boolean;
    createdAt: string;
}

interface NotificationsResponse {
    success: boolean;
    data: {
        notifications: Notification[];
        unreadCount: number;
    };
}

export function useNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get<NotificationsResponse>('/notifications');
            if (res.success) {
                setNotifications(res.data.notifications);
                setUnreadCount(res.data.unreadCount);
            }
            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error loading notifications');
        } finally {
            setLoading(false);
        }
    }, []);

    const markAsRead = useCallback(async (id: string) => {
        try {
            await api.put(`/notifications/${id}/read`, {});
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch {
            // Silently fail
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        try {
            await api.put('/notifications/read-all', {});
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch {
            // Silently fail
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    return {
        notifications,
        unreadCount,
        loading,
        error,
        fetchNotifications,
        markAsRead,
        markAllAsRead
    };
}
