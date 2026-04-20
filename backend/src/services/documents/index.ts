/**
 * Unified DocumentTemplateService re-exported from focused sub-modules.
 *
 * This module preserves the exact same public API as the original monolithic
 * DocumentTemplateService so that existing consumers continue to work unchanged.
 */

import { generateUniform, generateUniformInternal } from './UniformService';
import { generateEPI, generateEPIInternal } from './EPIService';
import { generateNDA, generateRGPD, generateModel145 } from './LegalDocumentService';
import { generateTechDevice, generateTechDeviceInternal } from './TechDeviceService';
import { signDocument } from './DocumentSignService';

export const DocumentTemplateService = {
    generateUniform,
    generateUniformInternal,
    generateEPI,
    generateEPIInternal,
    generateNDA,
    generateRGPD,
    generateModel145,
    generateTechDevice,
    generateTechDeviceInternal,
    signDocument,
};
