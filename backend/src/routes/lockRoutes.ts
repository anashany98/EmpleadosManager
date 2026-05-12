import { Router } from 'express';
import { lockService } from '../services/LockService';
import { protect } from '../middlewares/authMiddleware';
import { AuthenticatedRequest } from '../types/express';
import { AppError } from '../utils/AppError';

const router = Router();

router.post('/employee/:id', protect, async (req, res, next) => {
    try {
        const employeeId = req.params.id;
        if (!employeeId || typeof employeeId !== 'string') {
            throw new AppError('Invalid employee ID', 400);
        }

        const result = await lockService.acquire(employeeId, (req as AuthenticatedRequest).user);

        if (!result.success) {
            return res.status(409).json({
                success: false,
                error: 'LOCK_HELD',
                lock: result.conflict?.lock
            });
        }

        return res.status(200).json({
            success: true,
            lock: result.lock
        });
    } catch (error) {
        next(error);
    }
});

router.delete('/employee/:id', protect, async (req, res, next) => {
    try {
        const employeeId = req.params.id;
        if (!employeeId || typeof employeeId !== 'string') {
            throw new AppError('Invalid employee ID', 400);
        }

        await lockService.release(employeeId, (req as AuthenticatedRequest).user);

        return res.status(200).json({ success: true });
    } catch (error) {
        if (error instanceof Error && error.message === 'NOT_LOCK_OWNER') {
            return res.status(403).json({
                success: false,
                error: 'NOT_LOCK_OWNER'
            });
        }
        next(error);
    }
});

router.get('/employee/:id', protect, async (req, res, next) => {
    try {
        const employeeId = req.params.id;
        if (!employeeId || typeof employeeId !== 'string') {
            throw new AppError('Invalid employee ID', 400);
        }

        const lockInfo = await lockService.getLockInfo(employeeId, (req as AuthenticatedRequest).user.id);

        return res.status(200).json(lockInfo);
    } catch (error) {
        next(error);
    }
});

router.post('/employee/:id/force', protect, async (req, res, next) => {
    try {
        const employeeId = req.params.id;
        if (!employeeId || typeof employeeId !== 'string') {
            throw new AppError('Invalid employee ID', 400);
        }

        const { reason } = req.body || {};

        await lockService.forceRelease(employeeId, (req as AuthenticatedRequest).user, reason);

        return res.status(200).json({ success: true });
    } catch (error) {
        if (error instanceof Error && error.message === 'ADMIN_REQUIRED') {
            return res.status(403).json({
                success: false,
                error: 'ADMIN_REQUIRED'
            });
        }
        next(error);
    }
});

router.post('/employee/:id/refresh', protect, async (req, res, next) => {
    try {
        const employeeId = req.params.id;
        if (!employeeId || typeof employeeId !== 'string') {
            throw new AppError('Invalid employee ID', 400);
        }

        const result = await lockService.refresh(employeeId, (req as AuthenticatedRequest).user);

        if (!result.success) {
            return res.status(409).json({
                success: false,
                error: result.error
            });
        }

        return res.status(200).json({
            success: true,
            lock: result.lock
        });
    } catch (error) {
        next(error);
    }
});

export default router;