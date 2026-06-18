import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

interface TimeEntry {
    id: string;
    employeeId: string;
    type: 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END' | 'LUNCH_START' | 'LUNCH_END';
    timestamp: string;
    location?: { lat: number; lng: number };
}

interface TimeEntriesResponse {
    success: boolean;
    data: TimeEntry[];
}

export function useTimeEntries(employeeId?: string) {
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentStatus, setCurrentStatus] = useState<'IN' | 'OUT' | 'BREAK' | 'LUNCH'>('OUT');

    const fetchEntries = useCallback(async () => {
        try {
            setLoading(true);
            // Backend: /api/time-entries/history supports ?employeeId=X
            const params = employeeId ? { employeeId } : undefined;
            const res = await api.get<TimeEntriesResponse>('/time-entries/history', { params });
            if (res.success) {
                setEntries(res.data);

                // Determine current status from last entry
                if (res.data.length > 0) {
                    const lastEntry = res.data[0];
                    switch (lastEntry.type) {
                        case 'IN': setCurrentStatus('IN'); break;
                        case 'OUT': setCurrentStatus('OUT'); break;
                        case 'BREAK_START': setCurrentStatus('BREAK'); break;
                        case 'BREAK_END': setCurrentStatus('IN'); break;
                        case 'LUNCH_START': setCurrentStatus('LUNCH'); break;
                        case 'LUNCH_END': setCurrentStatus('IN'); break;
                    }
                }
            }
            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error loading time entries');
        } finally {
            setLoading(false);
        }
    }, [employeeId]);

    // Backend uses /api/time-entries/clock with type in body
    const clockIn = useCallback(async (location?: { lat: number; lng: number }) => {
        const res = await api.post<{ success: boolean; data: TimeEntry }>('/time-entries/clock', { type: 'IN', location });
        if (res.success) {
            setEntries(prev => [res.data, ...prev]);
            setCurrentStatus('IN');
            return res.data;
        }
        throw new Error('Clock in failed');
    }, []);

    const clockOut = useCallback(async (location?: { lat: number; lng: number }) => {
        const res = await api.post<{ success: boolean; data: TimeEntry }>('/time-entries/clock', { type: 'OUT', location });
        if (res.success) {
            setEntries(prev => [res.data, ...prev]);
            setCurrentStatus('OUT');
            return res.data;
        }
        throw new Error('Clock out failed');
    }, []);

    const startBreak = useCallback(async () => {
        const res = await api.post<{ success: boolean; data: TimeEntry }>('/time-entries/clock', { type: 'BREAK_START' });
        if (res.success) {
            setEntries(prev => [res.data, ...prev]);
            setCurrentStatus('BREAK');
            return res.data;
        }
        throw new Error('Break start failed');
    }, []);

    const endBreak = useCallback(async () => {
        const res = await api.post<{ success: boolean; data: TimeEntry }>('/time-entries/clock', { type: 'BREAK_END' });
        if (res.success) {
            setEntries(prev => [res.data, ...prev]);
            setCurrentStatus('IN');
            return res.data;
        }
        throw new Error('Break end failed');
    }, []);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    return {
        entries,
        currentStatus,
        loading,
        error,
        fetchEntries,
        clockIn,
        clockOut,
        startBreak,
        endBreak
    };
}
