ALTER TABLE "PayrollControlDailyEntry"
    ADD COLUMN "isCalendarHoliday" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "holidayName" TEXT;
