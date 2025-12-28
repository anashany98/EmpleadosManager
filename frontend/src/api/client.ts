const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = {
    get: async (endpoint: string, options: any = {}) => {
        const res = await fetch(`${API_URL}${endpoint}`);
        if (!res.ok) throw new Error(await res.text());
        if (options.responseType === 'blob') return res.blob();
        return res.json();
    },
    post: async (endpoint: string, body: any) => {
        const isFormData = body instanceof FormData;
        const headers: any = {};
        if (!isFormData) headers['Content-Type'] = 'application/json';

        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: isFormData ? body : JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },
    put: async (endpoint: string, body: any) => {
        const headers: any = { 'Content-Type': 'application/json' };
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },
    patch: async (endpoint: string, body: any) => {
        const headers: any = { 'Content-Type': 'application/json' };
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },
    delete: async (endpoint: string) => {
        const res = await fetch(`${API_URL}${endpoint}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }
};
