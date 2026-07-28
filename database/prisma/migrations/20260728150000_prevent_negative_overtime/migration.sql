-- Una jornada incompleta no es una hora extra negativa. Reparamos únicamente
-- los registros afectados y conservamos cualquier sobrescritura manual.
UPDATE "PayrollControlDailyEntry"
SET "overtimeHours" = GREATEST("overtimeHours", 0),
    "holidayOvertimeHours" = GREATEST("holidayOvertimeHours", 0),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "overtimeHours" < 0 OR "holidayOvertimeHours" < 0;

WITH source AS (
    SELECT
        r.*,
        GREATEST(r."overtimeHours", 0) AS new_overtime_hours,
        GREATEST(r."holidayOvertimeHours", 0) AS new_holiday_hours
    FROM "PayrollControlRecord" r
    WHERE r."overtimeHours" < 0 OR r."holidayOvertimeHours" < 0
),
amounts AS (
    SELECT
        s.*,
        ROUND((s."overtimeRate" * s.new_overtime_hours) + (s."holidayOvertimeRate" * s.new_holiday_hours), 2) AS new_total_calculated,
        ROUND(1 - s."irpf" - s."tgss", 4) AS new_available_calculated
    FROM source s
),
effective AS (
    SELECT
        a.*,
        CASE WHEN a."isTotalOvertimeAmountManual" AND a."totalOvertimeAmountManual" IS NOT NULL
            THEN a."totalOvertimeAmountManual" ELSE a.new_total_calculated END AS effective_total,
        CASE WHEN a."isAvailablePercentageManual" AND a."availablePercentageManual" IS NOT NULL
            THEN a."availablePercentageManual" ELSE a.new_available_calculated END AS effective_available
    FROM amounts a
),
gross_values AS (
    SELECT
        e.*,
        CASE WHEN e.effective_available > 0
            THEN ROUND(e.effective_total / e.effective_available, 2) ELSE 0 END AS new_gross_calculated
    FROM effective e
),
gross_effective AS (
    SELECT
        g.*,
        CASE WHEN g."isGrossManual" AND g."grossManual" IS NOT NULL
            THEN g."grossManual" ELSE g.new_gross_calculated END AS effective_gross
    FROM gross_values g
),
productivity_values AS (
    SELECT
        g.*,
        CASE WHEN g.effective_gross > 0
            THEN ROUND(g."positiveVariable" / g.effective_gross, 4) ELSE 0 END AS new_productivity_calculated
    FROM gross_effective g
),
final_values AS (
    SELECT
        p.*,
        CASE WHEN p."isProductivityManual" AND p."productivityManual" IS NOT NULL
            THEN p."productivityManual" ELSE p.new_productivity_calculated END AS effective_productivity
    FROM productivity_values p
)
UPDATE "PayrollControlRecord" r
SET
    "overtimeHours" = f.new_overtime_hours,
    "holidayOvertimeHours" = f.new_holiday_hours,
    "totalOvertimeAmountCalculated" = f.new_total_calculated,
    "totalOvertimeAmount" = f.effective_total,
    "availablePercentageCalculated" = f.new_available_calculated,
    "availablePercentage" = f.effective_available,
    "grossCalculated" = f.new_gross_calculated,
    "gross" = f.effective_gross,
    "productivityCalculated" = f.new_productivity_calculated,
    "productivity" = f.effective_productivity,
    "hoursCalculated" = ROUND(f.effective_gross - f.effective_productivity, 2),
    "hoursAmount" = CASE WHEN f."isHoursAmountManual" AND f."hoursAmountManual" IS NOT NULL
        THEN f."hoursAmountManual" ELSE ROUND(f.effective_gross - f.effective_productivity, 2) END,
    "differenceCalculated" = ROUND(f.effective_gross - f.effective_total, 2),
    "difference" = CASE WHEN f."isDifferenceManual" AND f."differenceManual" IS NOT NULL
        THEN f."differenceManual" ELSE ROUND(f.effective_gross - f.effective_total, 2) END,
    "reconciliationCalculated" = ROUND(
        f.effective_gross - (f.effective_gross * f."irpf") - (f.effective_gross * f."tgss") - f.effective_total,
        4
    ),
    "version" = r."version" + 1,
    "updatedAt" = CURRENT_TIMESTAMP
FROM final_values f
WHERE r.id = f.id;

ALTER TABLE "PayrollControlDailyEntry"
    ADD CONSTRAINT "PayrollControlDailyEntry_overtimeHours_nonnegative"
        CHECK ("overtimeHours" >= 0),
    ADD CONSTRAINT "PayrollControlDailyEntry_holidayOvertimeHours_nonnegative"
        CHECK ("holidayOvertimeHours" >= 0);

ALTER TABLE "PayrollControlRecord"
    ADD CONSTRAINT "PayrollControlRecord_overtimeHours_nonnegative"
        CHECK ("overtimeHours" >= 0),
    ADD CONSTRAINT "PayrollControlRecord_holidayOvertimeHours_nonnegative"
        CHECK ("holidayOvertimeHours" >= 0);
