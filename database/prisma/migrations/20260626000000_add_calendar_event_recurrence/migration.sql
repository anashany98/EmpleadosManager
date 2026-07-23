-- Recurrence fields for CalendarEvent.
-- Originally added in commit de617c1 (calendar improvements) as a legacy
-- SQL file but the columns were never present in the live database.
-- This migration backfills them so the running schema matches Prisma's
-- expectation (recurrence + recurrenceEnd).
ALTER TABLE "CalendarEvent" ADD COLUMN "recurrence"    TEXT         NOT NULL DEFAULT 'NONE';
ALTER TABLE "CalendarEvent" ADD COLUMN "recurrenceEnd" TIMESTAMP(3);
