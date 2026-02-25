import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { toast } from 'sonner';

// Types
export interface Evaluation {
    id: string;
    templateId: string;
    template: {
        id: string;
        name: string;
        type: string;
        competencies: any[];
        scaleConfig: any;
    };
    employeeId: string;
    employee: {
        id: string;
        name: string;
        firstName: string | null;
        lastName: string | null;
        jobTitle: string | null;
        department: string | null;
    };
    evaluatorId: string;
    evaluator: {
        id: string;
        name: string;
        firstName: string | null;
        lastName: string | null;
    };
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    status: string;
    selfScores: Record<string, number> | null;
    managerScores: Record<string, number> | null;
    finalScore: number | null;
    strengths: string | null;
    improvements: string | null;
    managerComments: string | null;
    selfSubmittedAt: string | null;
    managerSubmittedAt: string | null;
    acknowledgedAt: string | null;
    createdAt: string;
}

export interface Objective {
    id: string;
    employeeId: string;
    employee: {
        id: string;
        name: string;
        firstName: string | null;
        lastName: string | null;
        jobTitle: string | null;
        department: string | null;
    };
    title: string;
    description: string | null;
    category: string;
    targetValue: number | null;
    actualValue: number | null;
    unit: string | null;
    weight: number;
    startDate: string;
    dueDate: string;
    status: string;
    progress: number;
    achievementScore: number | null;
    managerComments: string | null;
}

export interface PDI {
    id: string;
    employeeId: string;
    employee: {
        id: string;
        name: string;
        firstName: string | null;
        lastName: string | null;
        jobTitle: string | null;
    };
    status: string;
    startDate: string;
    endDate: string | null;
    goals: any[];
    skills: any[];
    training: any[];
    mentoring: any;
    progress: number;
}

// Evaluation hooks
export function useEvaluations(filters?: {
    employeeId?: string;
    evaluatorId?: string;
    status?: string;
}) {
    return useQuery({
        queryKey: ['evaluations', filters],
        queryFn: async () => {
            const response = await api.get('/performance/evaluations', { params: filters });
            return response.data as Evaluation[];
        },
    });
}

export function useEvaluation(id: string) {
    return useQuery({
        queryKey: ['evaluation', id],
        queryFn: async () => {
            const response = await api.get(`/performance/evaluations/${id}`);
            return response.data as Evaluation;
        },
        enabled: !!id,
    });
}

export function useSubmitSelfEvaluation() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: {
            selfScores: Record<string, number>;
            strengths?: string;
            improvements?: string;
        }}) => {
            const response = await api.post(`/performance/evaluations/${id}/self-evaluate`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['evaluations'] });
            toast.success('Autoevaluación enviada correctamente');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Error al enviar autoevaluación');
        },
    });
}

export function useSubmitManagerEvaluation() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: {
            managerScores: Record<string, number>;
            managerComments?: string;
        }}) => {
            const response = await api.post(`/performance/evaluations/${id}/manager-evaluate`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['evaluations'] });
            toast.success('Evaluación enviada correctamente');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Error al enviar evaluación');
        },
    });
}

// Objective hooks
export function useObjectives(filters?: {
    employeeId?: string;
    status?: string;
    category?: string;
}) {
    return useQuery({
        queryKey: ['objectives', filters],
        queryFn: async () => {
            const response = await api.get('/performance/objectives', { params: filters });
            return response.data as Objective[];
        },
    });
}

export function useObjective(id: string) {
    return useQuery({
        queryKey: ['objective', id],
        queryFn: async () => {
            const response = await api.get(`/performance/objectives/${id}`);
            return response.data as Objective;
        },
        enabled: !!id,
    });
}

export function useCreateObjective() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (data: any) => {
            const response = await api.post('/performance/objectives', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['objectives'] });
            toast.success('Objetivo creado correctamente');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Error al crear objetivo');
        },
    });
}

export function useUpdateObjectiveProgress() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async ({ id, progress, actualValue }: { 
            id: string; 
            progress: number;
            actualValue?: number;
        }) => {
            const response = await api.patch(`/performance/objectives/${id}/progress`, {
                progress,
                actualValue
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['objectives'] });
            toast.success('Progreso actualizado');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Error al actualizar progreso');
        },
    });
}

// PDI hooks
export function usePDIs(filters?: { employeeId?: string; status?: string }) {
    return useQuery({
        queryKey: ['pdis', filters],
        queryFn: async () => {
            const response = await api.get('/performance/pdis', { params: filters });
            return response.data as PDI[];
        },
    });
}

export function usePDI(id: string) {
    return useQuery({
        queryKey: ['pdi', id],
        queryFn: async () => {
            const response = await api.get(`/performance/pdis/${id}`);
            return response.data as PDI;
        },
        enabled: !!id,
    });
}

export function useActivePDI(employeeId: string) {
    return useQuery({
        queryKey: ['pdi', 'active', employeeId],
        queryFn: async () => {
            const response = await api.get(`/performance/pdis/active/${employeeId}`);
            return response.data as PDI | null;
        },
        enabled: !!employeeId,
    });
}

export function useCreatePDI() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (data: any) => {
            const response = await api.post('/performance/pdis', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pdis'] });
            toast.success('PDI creado correctamente');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Error al crear PDI');
        },
    });
}

// Stats hooks
export function useEvaluationStats(filters?: { department?: string }) {
    return useQuery({
        queryKey: ['evaluation-stats', filters],
        queryFn: async () => {
            const response = await api.get('/performance/evaluations/stats', { params: filters });
            return response.data;
        },
    });
}

export function useObjectiveStats(employeeId?: string) {
    return useQuery({
        queryKey: ['objective-stats', employeeId],
        queryFn: async () => {
            const response = await api.get('/performance/objectives/stats', { 
                params: { employeeId } 
            });
            return response.data;
        },
    });
}