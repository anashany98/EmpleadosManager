export type ClockQueueItem = {
    id: string;
    type: string;
    payload: {
        type: string;
        latitude: number | null;
        longitude: number | null;
        device: string;
        timestamp: string;
    };
    createdAt: string;
};

const STORAGE_KEY = 'offline_clock_queue_v1';

const loadQueue = (): ClockQueueItem[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
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
            ...input
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
