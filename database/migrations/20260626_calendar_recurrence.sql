-- Add recurrence fields to CalendarEvent
ALTER TABLE "CalendarEvent" ADD COLUMN "recurrence" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "CalendarEvent" ADD COLUMN "recurrenceEnd" TIMESTAMP(3);
