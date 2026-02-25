
import { Router } from 'express';
import { CalendarController } from '../controllers/CalendarController';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

// Public route (protected by HMAC signature in query params)
router.get('/feed', CalendarController.getFeed);

// Protected route to get the subscription link
router.get('/link', protect, CalendarController.getSubscriptionLink);

// =========================================
// UNIFIED CALENDAR ROUTES
// =========================================

// Get unified calendar events (vacations, birthdays, events, holidays)
router.get('/unified', protect, CalendarController.getUnifiedEvents);

// Get birthdays for month
router.get('/birthdays', protect, CalendarController.getBirthdays);

// CRUD operations for calendar events (admin/HR only)
router.get('/events', protect, CalendarController.getAllEvents);
router.post('/events', protect, CalendarController.createEvent);
router.put('/events/:id', protect, CalendarController.updateEvent);
router.delete('/events/:id', protect, CalendarController.deleteEvent);

export default router;
