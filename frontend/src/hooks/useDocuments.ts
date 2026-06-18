import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

interface Document {
    id: string;
    name: string;
    type: string;
    fileUrl: string;
    employeeId: string;
    createdAt: string;
    updatedAt: string;
}

interface DocumentsResponse {
    success: boolean;
    message?: string;
    data: Document[];
    meta?: { total: number; page: number; limit: number; totalPages: number };
}

export function useDocuments(employeeId?: string) {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDocuments = useCallback(async () => {
        try {
            setLoading(true);
            const endpoint = employeeId 
                ? `/documents/employee/${employeeId}`
                : '/documents';
            const res = await api.get<DocumentsResponse>(endpoint);
            if (res.success) {
                setDocuments(res.data);
            }
            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error loading documents');
        } finally {
            setLoading(false);
        }
    }, [employeeId]);

    const uploadDocument = useCallback(async (file: File, metadata: Partial<Document>) => {
        const formData = new FormData();
        formData.append('file', file);
        Object.entries(metadata).forEach(([key, value]) => {
            if (value !== undefined) formData.append(key, String(value));
        });
        const res = await api.post<{ success: boolean; data: Document }>('/documents', formData);
        if (res.success) {
            setDocuments(prev => [res.data, ...prev]);
            return res.data;
        }
        throw new Error('Upload failed');
    }, []);

    const deleteDocument = useCallback(async (id: string) => {
        await api.delete(`/documents/${id}`);
        setDocuments(prev => prev.filter(d => d.id !== id));
    }, []);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    return {
        documents,
        loading,
        error,
        fetchDocuments,
        uploadDocument,
        deleteDocument
    };
}
