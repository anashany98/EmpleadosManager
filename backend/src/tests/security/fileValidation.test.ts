import { describe, it, expect } from 'vitest';
import { validateFileSignature, isPdf, isExcel, isOfficeDoc, validateImageMagicBytes } from '../../utils/fileValidation';

describe('File Validation Security Tests', () => {
    describe('validateFileSignature', () => {
        it('should validate PDF files correctly', () => {
            const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
            expect(() => validateFileSignature(pdfBuffer, '.pdf')).not.toThrow();
        });

        it('should reject file with mismatched content', () => {
            const fakePdf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
            expect(() => validateFileSignature(fakePdf, '.pdf')).toThrow();
        });

        it('should validate JPEG files correctly', () => {
            const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
            expect(() => validateFileSignature(jpegBuffer, '.jpg')).not.toThrow();
        });

        it('should validate PNG files correctly', () => {
            const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            expect(() => validateFileSignature(pngBuffer, '.png')).not.toThrow();
        });

        it('should reject too-small files', () => {
            const smallBuffer = Buffer.from([0x00, 0x01]);
            expect(() => validateFileSignature(smallBuffer, '.pdf')).toThrow();
        });
    });

    describe('isPdf', () => {
        it('should return true for valid PDF', () => {
            const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46]);
            expect(isPdf(pdfBuffer)).toBe(true);
        });

        it('should return false for non-PDF', () => {
            const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF]);
            expect(isPdf(jpegBuffer)).toBe(false);
        });
    });

    describe('isExcel', () => {
        it('should return true for XLSX (ZIP-based)', () => {
            const xlsxBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
            expect(isExcel(xlsxBuffer)).toBe(true);
        });
    });

    describe('validateImageMagicBytes', () => {
        it('should validate JPEG as image', () => {
            const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
            expect(validateImageMagicBytes(jpegBuffer)).toBe(true);
        });

        it('should validate PNG as image', () => {
            const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            expect(validateImageMagicBytes(pngBuffer)).toBe(true);
        });

        it('should not validate PDF as image', () => {
            const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46]);
            expect(validateImageMagicBytes(pdfBuffer)).toBe(false);
        });
    });
});