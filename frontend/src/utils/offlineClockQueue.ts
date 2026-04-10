export type ClockQueueItem = {
    id: string;
    type: string;
    payload: {
        type: string;
        latitude: number | null;
        longitude: number | null;
        device: string;
        timestamp: string;
        clientRequestId: string;
    };
    createdAt: string;
};

const STORAGE_KEY = 'offline_clock_queue_v1';

export const createClientRequestId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const loadQueue = (): ClockQueueItem[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter((item) => item && typeof item === 'object' && item.payload && typeof item.payload === 'object')
            .map((item) => ({
                ...item,
                payload: {
                    ...item.payload,
                    clientRequestId: item.payload.clientRequestId || createClientRequestId()
                }
            }));
    } catch {
        return [];
    }
};

const saveQueue = (items: ClockQueueItem[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const OfflineClockQueue = {
    getAll() {
        return loadQueue();
    },
    count() {
        return loadQueue().length;
    },
    enqueue(input: Omit<ClockQueueItem, 'id' | 'createdAt'>) {
        const items = loadQueue();
        const item: ClockQueueItem = {
            id: generateId(),
            createdAt: new Date().toISOString(),
            ...input,
            payload: {
                ...input.payload,
                clientRequestId: input.payload.clientRequestId || createClientRequestId()
            }
        };
        items.push(item);
        saveQueue(items);
        return item;
    },
    remove(id: string) {
        const items = loadQueue().filter(item => item.id !== id);
        saveQueue(items);
    },
    replace(items: ClockQueueItem[]) {
        saveQueue(items);
    },
    clear() {
        saveQueue([]);
    }
};
