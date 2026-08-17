import { createCanvas, DOMMatrix, ImageData } from 'canvas';
import jsQR from 'jsqr';
import jpeg from 'jpeg-js';
import { PDFDocument } from 'pdf-lib';
import { PNG } from 'pngjs';
import { createLogger } from '../LoggerService';

const log = createLogger('QrDocumentService');

export interface SystemQrPayload extends Record<string, unknown> {
    t: string;
    eid: string;
    d: string;
}

export interface QrFileMapping {
    qrType: string;
    category: string;
    namePattern: string;
}

export const DEFAULT_QR_FILE_MAPPINGS: QrFileMapping[] = [
    { qrType: 'VACATION_REQUEST', category: 'Ausencias', namePattern: 'Solicitud de vacaciones {{date}}' },
    { qrType: 'JUSTIFICANTE_AUSENCIA', category: 'Ausencias', namePattern: 'Justificante de ausencia {{date}}' },
    { qrType: 'EPI', category: 'PRL', namePattern: 'Entrega de EPI firmada {{date}}' },
    { qrType: 'UNIFORM', category: 'PRL', namePattern: 'Entrega de uniforme firmada {{date}}' },
    { qrType: 'TECH_DEVICE', category: 'Equipamiento', namePattern: 'Entrega de {{deviceName}} firmada {{date}}' },
    { qrType: 'ENTREGA_MATERIAL', category: 'Equipamiento', namePattern: 'Entrega de material firmada {{date}}' },
    { qrType: 'OBRA_EXPENSE_RECEIPT', category: 'Dietas y gastos', namePattern: 'Recibí de dietas y gastos {{date}}' },
    { qrType: 'MODEL_145', category: 'Contratos', namePattern: 'Modelo 145 firmado {{date}}' },
    { qrType: 'NDA', category: 'Documentación legal', namePattern: 'Acuerdo de confidencialidad {{date}}' },
    { qrType: 'RGPD', category: 'Documentación legal', namePattern: 'Cláusula RGPD {{date}}' },
    { qrType: 'CERTIFICADO_EMPRESA', category: 'Certificados', namePattern: 'Certificado de empresa {{date}}' },
    { qrType: 'CERTIFICADO_TRABAJO', category: 'Certificados', namePattern: 'Certificado de trabajo {{date}}' },
    { qrType: 'CARTA_FORMAL', category: 'Comunicaciones', namePattern: 'Comunicación formal {{date}}' },
    { qrType: 'PAYROLL_SIGNED', category: 'Nóminas', namePattern: 'Nómina firmada {{date}}' }
];

export const getDefaultQrFileMapping = (qrType: string): QrFileMapping | null =>
    DEFAULT_QR_FILE_MAPPINGS.find((mapping) => mapping.qrType === qrType) || null;

export const buildSystemQrPayload = (
    employeeId: string,
    documentType: string,
    extra?: Record<string, unknown>
): SystemQrPayload => ({
    ...(extra || {}),
    t: documentType,
    eid: employeeId,
    d: new Date().toISOString()
});

export const parseSystemQrPayload = (value: unknown): SystemQrPayload | null => {
    let candidate = value;
    if (typeof value === 'string') {
        try {
            candidate = JSON.parse(value);
        } catch {
            return null;
        }
    }
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
    const payload = candidate as Record<string, unknown>;
    if (typeof payload.t !== 'string' || !payload.t.trim()) return null;
    if (typeof payload.eid !== 'string' || !payload.eid.trim()) return null;
    return {
        ...payload,
        t: payload.t,
        eid: payload.eid,
        d: typeof payload.d === 'string' ? payload.d : new Date().toISOString()
    } as SystemQrPayload;
};

const decodeQrPixels = (
    data: Uint8Array | Uint8ClampedArray | Buffer,
    width: number,
    height: number
): SystemQrPayload | null => {
    const code = jsQR(new Uint8ClampedArray(data), width, height, {
        inversionAttempts: 'attemptBoth'
    });
    return code?.data ? parseSystemQrPayload(code.data) : null;
};

export const extractSystemQrFromImage = async (buffer: Buffer): Promise<SystemQrPayload | null> => {
    try {
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
            const pngData = await new Promise<PNG>((resolve, reject) => {
                new PNG().parse(buffer, (error, data) => error ? reject(error) : resolve(data));
            });
            return decodeQrPixels(pngData.data, pngData.width, pngData.height);
        }
        if (buffer[0] === 0xff && buffer[1] === 0xd8) {
            const jpegData = jpeg.decode(buffer, { useTArray: true });
            return decodeQrPixels(jpegData.data, jpegData.width, jpegData.height);
        }
        return null;
    } catch (error) {
        log.warn({ error }, 'Could not decode QR from image');
        return null;
    }
};

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
const dynamicImport = new Function('specifier', 'return import(specifier)') as
    (specifier: string) => Promise<PdfJsModule>;
let pdfJsPromise: Promise<PdfJsModule> | null = null;

const loadPdfJs = () => {
    if (!pdfJsPromise) {
        const globals = globalThis as Record<string, unknown>;
        globals.DOMMatrix ||= DOMMatrix;
        globals.ImageData ||= ImageData;
        pdfJsPromise = process.env.VITEST
            ? import('pdfjs-dist/legacy/build/pdf.mjs')
            : dynamicImport('pdfjs-dist/legacy/build/pdf.mjs');
    }
    return pdfJsPromise;
};

class PdfNodeCanvasFactory {
    create(width: number, height: number) {
        const canvas = createCanvas(width, height);
        return { canvas, context: canvas.getContext('2d') };
    }

    reset(target: ReturnType<PdfNodeCanvasFactory['create']>, width: number, height: number) {
        target.canvas.width = width;
        target.canvas.height = height;
    }

    destroy(target: ReturnType<PdfNodeCanvasFactory['create']>) {
        target.canvas.width = 0;
        target.canvas.height = 0;
    }
}

export const extractSystemQrFromPdf = async (
    buffer: Buffer,
    options: { includeMetadata?: boolean; maxPages?: number; renderScale?: number } = {}
): Promise<SystemQrPayload | null> => {
    const includeMetadata = options.includeMetadata !== false;
    if (includeMetadata) {
        try {
            const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
            const metadataPayload = parseSystemQrPayload(pdf.getSubject());
            if (metadataPayload) return metadataPayload;
        } catch (error) {
            log.warn({ error }, 'Could not read PDF metadata while looking for QR');
        }
    }

    try {
        const pdfjs = await loadPdfJs();
        const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(buffer),
            isEvalSupported: false,
            useSystemFonts: true,
            CanvasFactory: PdfNodeCanvasFactory
        });
        const pdf = await loadingTask.promise;
        const pagesToScan = Math.min(pdf.numPages, Math.max(1, options.maxPages || 3));
        const scale = Math.max(1.5, Math.min(3.5, options.renderScale || 2.5));

        for (let pageNumber = 1; pageNumber <= pagesToScan; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale });
            const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
            const context = canvas.getContext('2d');
            await page.render({
                canvasContext: context,
                viewport
            } as unknown as Parameters<typeof page.render>[0]).promise;
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const payload = decodeQrPixels(image.data, image.width, image.height);
            page.cleanup();
            if (payload) {
                await loadingTask.destroy();
                return payload;
            }
        }
        await loadingTask.destroy();
        return null;
    } catch (error) {
        log.warn({
            error: error instanceof Error
                ? { name: error.name, message: error.message, stack: error.stack }
                : error
        }, 'Could not decode visible QR from PDF pages');
        return null;
    }
};
