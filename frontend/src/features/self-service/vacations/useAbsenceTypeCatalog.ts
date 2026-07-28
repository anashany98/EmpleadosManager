import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client';
import { ABSENCE_TYPES, type AbsenceTypeConfig } from './types';

interface ApiAbsenceType {
    code: string;
    name: string;
    color: string;
    isActive: boolean;
    requiresAttachment: boolean;
    requiresApproval: boolean;
    countsForBalance: boolean;
}

const dynamicStyle: Omit<AbsenceTypeConfig, 'label'> = {
    color: 'bg-violet-500',
    text: 'text-violet-700',
    bgSoft: 'bg-violet-50',
    border: 'border-violet-200',
    icon: ABSENCE_TYPES.OTHER.icon,
};

export function useAbsenceTypeCatalog() {
    const [remoteTypes, setRemoteTypes] = useState<ApiAbsenceType[] | null>(null);

    const refresh = useCallback(async () => {
        try {
            const response = await api.get('/absence-types');
            const rows = Array.isArray(response.data) ? response.data : response.data?.data ?? [];
            setRemoteTypes(rows);
        } catch {
            setRemoteTypes(null);
        }
    }, []);

    useEffect(() => {
        void refresh();
        const handler = () => void refresh();
        window.addEventListener('absence-types-updated', handler);
        return () => window.removeEventListener('absence-types-updated', handler);
    }, [refresh]);

    const catalog = useMemo<Record<string, AbsenceTypeConfig>>(() => {
        if (!remoteTypes?.length) return ABSENCE_TYPES;
        return Object.fromEntries(remoteTypes.map((item) => {
            const fallback = ABSENCE_TYPES[item.code] || dynamicStyle;
            return [item.code, {
                ...fallback,
                label: item.name,
                hexColor: item.color,
                isActive: item.isActive,
                requiresAttachment: item.requiresAttachment,
                requiresApproval: item.requiresApproval,
                countsForBalance: item.countsForBalance,
            }];
        }));
    }, [remoteTypes]);

    const activeCatalog = useMemo(
        () => Object.fromEntries(Object.entries(catalog).filter(([, item]) => item.isActive !== false)),
        [catalog]
    );

    return { catalog, activeCatalog, refresh };
}
