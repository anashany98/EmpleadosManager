import PDFDocument from 'pdfkit';
import { describe, expect, it } from 'vitest';
import { buildPdfBuffer } from './DocumentPdfUtils';
import { renderLayoutTemplate, type LayoutTemplate } from './DocumentLayoutService';
import { extractSystemQrFromPdf, getDefaultQrFileMapping } from './QrDocumentService';

describe('document QR round trip', () => {
    it('classifies generated diet receipts in the worker file', () => {
        expect(getDefaultQrFileMapping('OBRA_EXPENSE_RECEIPT')).toEqual({
            qrType: 'OBRA_EXPENSE_RECEIPT',
            category: 'Dietas y gastos',
            namePattern: 'Recibí de dietas y gastos {{date}}'
        });
    });

    it('keeps a visible system QR readable after PDF metadata is unavailable', async () => {
        const layout: LayoutTemplate = {
            kind: 'layout-template',
            version: 1,
            elements: [
                {
                    id: 'title',
                    type: 'text',
                    x: 10,
                    y: 10,
                    w: 80,
                    h: 8,
                    text: 'Documento de prueba',
                    fontSize: 18
                }
            ]
        };
        const doc = new PDFDocument({ size: 'A4', margin: 0 });
        await renderLayoutTemplate(doc, layout, {}, {
            employeeId: 'employee-123',
            documentType: 'OBRA_EXPENSE_RECEIPT'
        });
        const buffer = await buildPdfBuffer(doc);

        const payload = await extractSystemQrFromPdf(buffer, {
            includeMetadata: false,
            maxPages: 1
        });

        expect(payload).toMatchObject({
            eid: 'employee-123',
            t: 'OBRA_EXPENSE_RECEIPT'
        });
    }, 15_000);
});
