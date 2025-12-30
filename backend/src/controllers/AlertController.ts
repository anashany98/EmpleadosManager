
import { Request, Response } from 'express';
import { alertService } from '../services/AlertService';

export class AlertController {
    // GET /api/alerts - Get unread alerts
    async getAlerts(req: Request, res: Response) {
        try {
            // Trigger generation on fetch (simple approach for now, instead of cron)
            await alertService.generateContractAlerts();

            const user = (req as any).user;
            const permissions = user?.role === 'admin' ? null : user?.permissions;

            const alerts = await alertService.getUnreadAlerts(permissions);
            res.json(alerts);
        } catch (error: any) {
            console.error('Error fetching alerts:', error);
            res.status(500).json({ error: 'Failed to fetch alerts' });
        }
    }

    // PUT /api/alerts/:id/read - Mark as read
    async markAsRead(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await alertService.markAsRead(id);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to mark alert as read' });
        }
    }

    // PUT /api/alerts/:id/dismiss - Dismiss
    async dismiss(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await alertService.dismissAlert(id);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to dismiss alert' });
        }
    }
}

export const alertController = new AlertController();
