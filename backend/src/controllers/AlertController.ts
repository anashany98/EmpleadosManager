
import { Request, Response } from 'express';
import { alertService } from '../services/AlertService';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';

const log = createLogger('AlertController');

export class AlertController {
    // GET /api/alerts - Get unread alerts
    async getAlerts(req: Request, res: Response) {
        try {
            const { user } = req as AuthenticatedRequest;
            const alerts = await alertService.getUnreadAlerts(user);
            res.json(alerts);
        } catch (_) {
            log.error({ error: _ }, 'Error fetching alerts');
            res.status(500).json({ error: 'Failed to fetch alerts' });
        }
    }

    // PUT /api/alerts/:id/read - Mark as read
    async markAsRead(req: Request, res: Response) {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            await alertService.markAsRead(id, user);
            res.json({ success: true });
        } catch {
            res.status(500).json({ error: 'Failed to mark alert as read' });
        }
    }

    // PUT /api/alerts/:id/dismiss - Dismiss
    async dismiss(req: Request, res: Response) {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            await alertService.dismissAlert(id, user);
            res.json({ success: true });
        } catch {
            res.status(500).json({ error: 'Failed to dismiss alert' });
        }
    }

    // PUT /api/alerts/read-all
    async markAllRead(req: Request, res: Response) {
        try {
            const { user } = req as AuthenticatedRequest;
            await alertService.markAllAsRead(user);
            res.json({ success: true });
        } catch {
            log.error('Error marking all as read');
            res.status(500).json({ error: 'Failed to mark all as read' });
        }
    }

    // PUT /api/alerts/dismiss-all
    async dismissAll(req: Request, res: Response) {
        try {
            const { user } = req as AuthenticatedRequest;
            await alertService.dismissAll(user);
            res.json({ success: true });
        } catch {
            log.error('Error dismissing all');
            res.status(500).json({ error: 'Failed to dismiss all' });
        }
    }
}

export const alertController = new AlertController();
