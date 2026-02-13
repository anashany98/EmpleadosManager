
import { Router } from 'express';
import { CalendarController } from '../controllers/CalendarController';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

// Public route (protected by HMAC signature in query params)
router.get('/feed', CalendarController.getFeed);

// Protected route to get the subscription link
router.get('/link', protect, CalendarController.getSubscriptionLink);

export default router;
