import { Router } from 'express';
import { TimeEntryController } from '../controllers/TimeEntryController';
import { protect, restrictTo } from '../middlewares/authMiddleware';

const router = Router();

router.use(protect); // All routes protected

router.get('/status', TimeEntryController.getStatus);
router.post('/clock', TimeEntryController.clock);
router.get('/history', TimeEntryController.getHistory);
router.get('/range', TimeEntryController.getHistory);

// Admin/HR only
router.post('/manual', restrictTo('admin', 'hr'), TimeEntryController.createManual);

export default router;
