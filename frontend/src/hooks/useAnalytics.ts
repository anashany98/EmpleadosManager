import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

// Tipos para las respuestas de la API del backend

export interface KPIData {
    totalEmployees: number;
    activeEmployees: number;
    newHires: number;
    departures: number;
    turnoverRate: number;
    avgTenure: number;
    openPositions: number;
    pendingRequests: number;
}

export interface HeadcountTrendData {
    month: string;
    count: number;
    newHires: number;
    exits: number;
}

export interface DepartmentData {
    department: string;
    count: number;
    percentage: number;
}

export interface HeatmapData {
    dayOfWeek: number;
    month: number;
    count: number;
}

export interface HiringFunnelData {
    vacancies: number;
    applications: number;
    interviews: number;
    offers: number;
    hired: number;
}

export interface OvertimeTrendData {
    month: string;
    hours: number;
    cost: number;
}

export interface TenureData {
    range: string;
    count: number;
}

export interface AnalyticsSummary {
    kpis: KPIData;
    headcountTrend: HeadcountTrendData[];
    departmentBreakdown: DepartmentData[];
    absenceHeatmap: HeatmapData[];
    hiringFunnel: HiringFunnelData;
    overtimeTrend: OvertimeTrendData[];
    tenureDistribution: TenureData[];
    generatedAt: string;
}

// Hook para obtener el resumen completo de analytics
export function useAnalyticsSummary() {
    return useQuery({
        queryKey: ['analytics', 'summary'],
        queryFn: async (): Promise<AnalyticsSummary> => {
            const response = await api.get('/analytics/summary');
            return response.data as AnalyticsSummary;
        },
        staleTime: 5 * 60 * 1000, // 5 minutos
        refetchOnWindowFocus: false,
    });
}

// Hook para obtener KPIs
export function useKPIs() {
    return useQuery({
        queryKey: ['analytics', 'kpis'],
        queryFn: async (): Promise<KPIData> => {
            const response = await api.get('/analytics/kpis');
            return response.data as KPIData;
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
}

// Hook para obtener tendencias de headcount
export function useTrends(period: 'month' | 'quarter' | 'year' = 'year') {
    return useQuery({
        queryKey: ['analytics', 'trends', 'headcount', period],
        queryFn: async () => {
            const response = await api.get('/analytics/trends/headcount', { 
                params: { months: period === 'year' ? 12 : period === 'quarter' ? 3 : 1 } 
            });
            return response.data as HeadcountTrendData[];
        },
        staleTime: 5 * 60 * 1000,
    });
}

// Hook para obtener distribución por departamento
export function useDepartmentBreakdown() {
    return useQuery({
        queryKey: ['analytics', 'departments'],
        queryFn: async (): Promise<DepartmentData[]> => {
            const response = await api.get('/analytics/departments');
            return response.data as DepartmentData[];
        },
        staleTime: 10 * 60 * 1000, // 10 minutos
    });
}

// Hook para obtener el heatmap de ausencias
export function useActivityHeatmap() {
    return useQuery({
        queryKey: ['analytics', 'heatmap'],
        queryFn: async (): Promise<HeatmapData[]> => {
            const response = await api.get('/analytics/heatmap/absences');
            return response.data as HeatmapData[];
        },
        staleTime: 30 * 60 * 1000, // 30 minutos
    });
}

// Hook para obtener el embudo de contratación
export function useHiringFunnel() {
    return useQuery({
        queryKey: ['analytics', 'hiring-funnel'],
        queryFn: async (): Promise<HiringFunnelData> => {
            const response = await api.get('/analytics/hiring-funnel');
            return response.data as HiringFunnelData;
        },
        staleTime: 10 * 60 * 1000,
    });
}

// Hook para obtener la distribución de antigüedad
export function useTenureDistribution() {
    return useQuery({
        queryKey: ['analytics', 'tenure'],
        queryFn: async () => {
            const response = await api.get('/analytics/tenure');
            return response.data as TenureData[];
        },
        staleTime: 10 * 60 * 1000,
    });
}