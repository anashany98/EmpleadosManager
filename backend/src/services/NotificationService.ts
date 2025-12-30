import { Response } from 'express';

interface Client {
    id: string;
    res: Response;
    userId?: string;
}

class NotificationService {
    private clients: Client[] = [];
    private static instance: NotificationService;

    private constructor() { }

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    addClient(id: string, res: Response, userId?: string) {
        this.clients.push({ id, res, userId });
        console.log(`Client ${id} connected. Total clients: ${this.clients.length}`);
    }

    removeClient(id: string) {
        this.clients = this.clients.filter(client => client.id !== id);
        console.log(`Client ${id} disconnected. Total clients: ${this.clients.length}`);
    }

    broadcast(type: string, data: any) {
        this.clients.forEach(client => {
            this.sendEventToClient(client, type, data);
        });
    }

    sendToUser(userId: string, type: string, data: any) {
        const userClients = this.clients.filter(c => c.userId === userId);
        userClients.forEach(client => {
            this.sendEventToClient(client, type, data);
        });
    }

    private sendEventToClient(client: Client, type: string, data: any) {
        // SSE format:
        // event: eventName
        // data: JSON string
        // \n\n
        client.res.write(`event: ${type}\n`);
        client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
}

export const notificationService = NotificationService.getInstance();
