import { Response } from 'express';

type Client = { res: Response };

const clientsByUser = new Map<string, Set<Client>>();

const writeEvent = (res: Response, event: string, data: any) => {
    try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
        // Stream closed or error writing. We can't recover easily here without removing the client.
        // The controller handles cleanup on 'close' event, but immediate error needs handling.
        console.warn('Failed to write to stream, client might have disconnected.', error);
        res.end(); // Try to close properly
    }
};

export const NotificationStream = {
    addClient(userId: string, res: Response) {
        const set = clientsByUser.get(userId) || new Set<Client>();
        set.add({ res });
        clientsByUser.set(userId, set);
    },

    removeClient(userId: string, res: Response) {
        const set = clientsByUser.get(userId);
        if (!set) return;
        for (const client of set) {
            if (client.res === res) {
                set.delete(client);
                break;
            }
        }
        if (set.size === 0) clientsByUser.delete(userId);
    },

    sendToUser(userId: string, event: string, payload: any) {
        const set = clientsByUser.get(userId);
        if (!set) return;
        for (const client of set) {
            writeEvent(client.res, event, payload);
        }
    },

    sendToUsers(userIds: string[], event: string, payload: any) {
        userIds.forEach(id => this.sendToUser(id, event, payload));
    }
};
