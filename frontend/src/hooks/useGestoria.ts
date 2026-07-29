/**
 * Hooks para el módulo de Gestoría.
 *
 * Patrón stateful consistente con `useDocuments`, `useExpenses`:
 * expone `loading`, `error`, y funciones de carga/mutación. Usa
 * el cliente `gestoriaApi` centralizado.
 */
import { useCallback, useEffect, useState } from 'react';
import { gestoriaApi } from '../api/gestoria';
import type {
    GestoriaConcept,
    GestoriaEmployeeRow,
    GestoriaPeriod,
    GestoriaColumnView
} from '../api/gestoria';

interface ListState<T> {
    data: T[];
    loading: boolean;
    error: string | null;
    reload: () => Promise<void>;
}

function useList<T>(loader: () => Promise<{ data: T[]; success: boolean; message?: string }>): ListState<T> {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await loader();
            setData(res.data || []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error');
        } finally {
            setLoading(false);
        }
    }, [loader]);

    useEffect(() => {
        reload();
    }, [reload]);

    return { data, loading, error, reload };
}

export function useGestoriaPeriods(companyId: string | undefined, status?: 'OPEN' | 'CLOSED') {
    return useList<GestoriaPeriod>(() => gestoriaApi.listPeriods(companyId!, status));
}

export function useGestoriaConcepts(periodId: string | undefined) {
    return useList<GestoriaConcept>(() => gestoriaApi.listConcepts(periodId!));
}

export function useGestoriaRows(
    periodId: string | undefined,
    filters?: { isReviewed?: boolean; department?: string; category?: string; search?: string }
) {
    return useList<GestoriaEmployeeRow>(() => gestoriaApi.listRows(periodId!, filters));
}

export function useGestoriaViews(periodId: string | undefined) {
    return useList<GestoriaColumnView>(() => gestoriaApi.listViews(periodId!));
}
