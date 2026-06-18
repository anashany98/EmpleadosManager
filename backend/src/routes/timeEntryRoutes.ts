import { Router } from 'express';
import { TimeEntryController } from '../controllers/TimeEntryController';
import { protect, restrictTo } from '../middlewares/authMiddleware';
import { validateResource } from '../middlewares/validateResource';
import {
    timeEntryClockSchema,
    timeEntryHistoryQuerySchema,
    timeEntryManualSchema,
    timeEntryIdParamSchema
} from '../schemas/timeEntrySchemas';

const router = Router();

router.use(protect); // All routes protected

router.get('/status', TimeEntryController.getStatus);
router.post('/clock', validateResource(timeEntryClockSchema), TimeEntryController.clock);
router.get('/history', validateResource(timeEntryHistoryQuerySchema), TimeEntryController.getHistory);
router.get('/range', validateResource(timeEntryHistoryQuerySchema), TimeEntryController.getHistory);

// Admin/HR only
router.post('/manual', restrictTo('admin', 'hr'), validateResource(timeEntryManualSchema), TimeEntryController.createManual);
router.delete('/:id', restrictTo('admin', 'hr'), validateResource(timeEntryIdParamSchema), TimeEntryController.deleteEntry);

export default router;
