import type { ReportType } from './reportTypes';

// HIGH-006: re-exportamos `buildRequestParams` desde
// `reportDataProcessing` para que `Reports.tsx` (y futuros
// consumidores) puedan importarlo desde este barrel junto con
// el resto de helpers. La implementación canónica vive en
// `reportDataProcessing.ts` para evitar imports circulares
// con los tipos de ReportType.
export { buildRequestParams } from './reportDataProcessing';

export const euroFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
export const numberFormatter = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function extractResponseData<T>(response: unknown): T {
    if (response && typeof response === 'object' && 'data' in (response as Record<string, unknown>)) {
        return (response as { data: T }).data;
    }

    return response as T;
}

export function formatCurrency(value: number) {
    return euroFormatter.format(value || 0);
}

export function formatNumber(value: number, suffix = '') {
    return `${numberFormatter.format(value || 0)}${suffix}`;
}

export function formatPercent(value: number) {
    return `${numberFormatter.format(value || 0)}%`;
}

export function formatDate(value?: string | null) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('es-ES');
}

export function formatTime(value?: string | null) {
    if (!value) return '-';
    return new Date(value).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export function toQueryString(params: Record<string, string>) {
    return new URLSearchParams(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    ).toString();
}

export function getAttendanceWindow(segments: Array<{ start: string; end: string | null; type: string }> = []) {
    if (segments.length === 0) {
        return {
            firstSegment: '-',
            lastSegment: '-',
            segmentsText: '-'
        };
    }

    const firstSegment = formatTime(segments[0].start);
    const lastClosedSegment = [...segments].reverse().find((segment) => segment.end);

    return {
        firstSegment,
        lastSegment: lastClosedSegment ? formatTime(lastClosedSegment.end) : 'Abierto',
        segmentsText: segments
            .map((segment) => `${formatTime(segment.start)} - ${segment.end ? formatTime(segment.end) : 'Abierto'} (${segment.type})`)
            .join(' | ')
    };
}

export function getPeriodLabel(activeTab: ReportType, filters: Record<string, string>) {
    if (activeTab === 'ATTENDANCE' || activeTab === 'OVERTIME' || activeTab === 'ABSENCES_DETAILED') {
        return `${filters.start} · ${filters.end}`;
    }

    if (activeTab === 'VACATIONS') {
        return `Año ${filters.year}`;
    }

    if (activeTab === 'GENDER_GAP') {
        return `Año ${filters.year}`;
    }

    return filters.month ? `${filters.month}/${filters.year}` : `Año ${filters.year}`;
}
