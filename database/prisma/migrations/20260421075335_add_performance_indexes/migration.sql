-- CreateIndex
CREATE INDEX "Document_expiryDate_idx" ON "Document"("expiryDate");

-- CreateIndex
CREATE INDEX "Document_uploadDate_idx" ON "Document"("uploadDate");

-- CreateIndex
CREATE INDEX "Document_employeeId_category_idx" ON "Document"("employeeId", "category");

-- CreateIndex
CREATE INDEX "Employee_active_idx" ON "Employee"("active");

-- CreateIndex
CREATE INDEX "Employee_department_idx" ON "Employee"("department");

-- CreateIndex
CREATE INDEX "Employee_contractType_idx" ON "Employee"("contractType");

-- CreateIndex
CREATE INDEX "Employee_contractEndDate_idx" ON "Employee"("contractEndDate");

-- CreateIndex
CREATE INDEX "Employee_entryDate_idx" ON "Employee"("entryDate");

-- CreateIndex
CREATE INDEX "Employee_dniExpiration_idx" ON "Employee"("dniExpiration");

-- CreateIndex
CREATE INDEX "Employee_managerId_idx" ON "Employee"("managerId");

-- CreateIndex
CREATE INDEX "Employee_email_idx" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_companyId_active_idx" ON "Employee"("companyId", "active");

-- CreateIndex
CREATE INDEX "Employee_companyId_department_idx" ON "Employee"("companyId", "department");

-- CreateIndex
CREATE INDEX "Employee_active_contractEndDate_idx" ON "Employee"("active", "contractEndDate");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "Expense_employeeId_status_idx" ON "Expense"("employeeId", "status");

-- CreateIndex
CREATE INDEX "InboxDocument_processed_idx" ON "InboxDocument"("processed");

-- CreateIndex
CREATE INDEX "InboxDocument_source_idx" ON "InboxDocument"("source");

-- CreateIndex
CREATE INDEX "InboxDocument_receivedAt_idx" ON "InboxDocument"("receivedAt");

-- CreateIndex
CREATE INDEX "InboxDocument_ocrStatus_idx" ON "InboxDocument"("ocrStatus");

-- CreateIndex
CREATE INDEX "TimeEntry_timestamp_idx" ON "TimeEntry"("timestamp");

-- CreateIndex
CREATE INDEX "TimeEntry_employeeId_type_idx" ON "TimeEntry"("employeeId", "type");

-- CreateIndex
CREATE INDEX "TimeEntry_timestamp_employeeId_idx" ON "TimeEntry"("timestamp", "employeeId");

-- CreateIndex
CREATE INDEX "Vacation_employeeId_status_idx" ON "Vacation"("employeeId", "status");

-- CreateIndex
CREATE INDEX "Vacation_startDate_endDate_idx" ON "Vacation"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Vacation_status_idx" ON "Vacation"("status");
