## Summary

Fixes three critical bugs affecting daily HR operations: empty "Responsable Directo" dropdown, reports failing to load (especially vacations), and orphaned files on disk when database writes fail.

## Changes

### 1. Responsable Directo dropdown shows no employees

- **Root cause**: `EmployeeController.getAll` used `ApiResponse.success(res, result)` where `result` was already `{ data: [...], meta }`. This created double-nested `.data`: `{ data: { data: [...], meta } }`. The frontend's `extractArray` only unwrapped one level, receiving an object instead of an array.
- **Fix**: Changed to `ApiResponse.paginated(res, result.data, result.meta)` which produces a single `.data` layer.

### 2. Reports "Error al cargar" (especially vacation report)

- **Root cause 1**: `reportRoutes.ts` applied `protect` + `checkPermission` middleware that was already applied at the app level in `registerRoutes.ts`, doubling DB queries per request.
- **Root cause 2**: `VacationReportService.computeVacationData` called `getEmployeeVacationBalanceSummary` per employee (3+ DB queries each), causing N+1 query pattern. With 100+ employees, this exceeded the 30s frontend timeout.
- **Fix**: Removed duplicate middleware; refactored to batch `employeeVacationBalance` lookups in a single query and compute balances in-memory.

### 3. Orphaned files on disk

- **Root cause**: All 8 document services saved files to disk via `StorageService.saveBuffer()` before creating DB records via `prisma.document.create()`. If the DB write failed, the file was orphaned with no cleanup.
- **Fix**: Wrapped `document.create()` in try/catch with `StorageService.deleteFile(key)` compensation on failure.

### Minor fixes

- `StorageService.deleteFile` now uses async `fs.promises` instead of sync I/O
- `documentUploadMetadataSchema`: `employeeId` changed from optional to required (was inconsistent with controller validation)
- Exported `roundVacationValue` and `calculateVacationOverlapDays` from `VacationBalanceService`

## Files modified (14)

- `backend/src/controllers/EmployeeController.ts` - ApiResponse.paginated fix
- `backend/src/controllers/DocumentController.ts` - orphaned file cleanup
- `backend/src/routes/reportRoutes.ts` - remove duplicate middleware
- `backend/src/schemas/documentSchemas.ts` - employeeId required
- `backend/src/services/StorageService.ts` - async deleteFile
- `backend/src/services/VacationBalanceService.ts` - export helpers
- `backend/src/services/reports/VacationReportService.ts` - batched queries
- `backend/src/services/documents/{DocumentSignService,DocumentTemplateService,EPIService,LegalDocumentService,MaterialDeliveryService,TechDeviceService,UniformService}.ts` - orphaned file cleanup

## Validation

- TypeScript compilation passes (no new errors)
- Pre-commit hooks (lint-staged) pass
