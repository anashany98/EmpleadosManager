/**
 * Backward-compatible re-export from the refactored documents module.
 *
 * The implementation has been split into focused sub-modules under ./documents/:
 *   - DocumentPdfUtils.ts     – shared PDF helpers (logo, QR code, buffer builder)
 *   - UniformService.ts       – generateUniform / generateUniformInternal
 *   - EPIService.ts           – generateEPI / generateEPIInternal
 *   - LegalDocumentService.ts – generateNDA / generateRGPD / generateModel145
 *   - TechDeviceService.ts    – generateTechDevice / generateTechDeviceInternal
 *   - DocumentSignService.ts  – signDocument
 *
 * The public API is unchanged; all existing importers continue to work.
 */
export { DocumentTemplateService } from './documents/index';
