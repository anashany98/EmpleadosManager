import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { getLogoPath } from './DocumentPdfUtils';

export type LayoutElementType = 'text' | 'variable' | 'box' | 'logo' | 'qr';

export interface LayoutTemplatePage {
    backgroundColor?: string;
    showGrid?: boolean;
}

interface LayoutBaseElement {
    id: string;
    type: LayoutElementType;
    x: number;
    y: number;
    w: number;
    h: number;
    zIndex?: number;
    opacity?: number;
}

export interface LayoutTextElement extends LayoutBaseElement {
    type: 'text';
    text: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    color?: string;
    align?: 'left' | 'center' | 'right' | 'justify';
    lineHeight?: number;
}

export interface LayoutVariableElement extends LayoutBaseElement {
    type: 'variable';
    variable: string;
    prefix?: string;
    suffix?: string;
    fallback?: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    color?: string;
    align?: 'left' | 'center' | 'right' | 'justify';
    lineHeight?: number;
}

export interface LayoutBoxElement extends LayoutBaseElement {
    type: 'box';
    fillColor?: string;
    borderColor?: string;
    borderWidth?: number;
    radius?: number;
}

export interface LayoutLogoElement extends LayoutBaseElement {
    type: 'logo';
    source?: 'company' | 'default' | 'custom';
    url?: string;
    fit?: 'contain' | 'cover';
}

export interface LayoutQrElement extends LayoutBaseElement {
    type: 'qr';
    dataSource?: 'document' | 'custom' | 'variable';
    value?: string;
    color?: string;
    backgroundColor?: string;
}

export type LayoutElement =
    | LayoutTextElement
    | LayoutVariableElement
    | LayoutBoxElement
    | LayoutLogoElement
    | LayoutQrElement;

export interface LayoutTemplate {
    kind: 'layout-template';
    version: number;
    page?: LayoutTemplatePage;
    elements: LayoutElement[];
}

interface LayoutRenderOptions {
    employeeId: string;
    documentType: string;
    qrData?: Record<string, unknown>;
}

const DEFAULT_LAYOUT_VERSION = 1;

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const percentToPoint = (value: number, total: number) => (clampPercent(value) / 100) * total;

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isLayoutElement = (value: unknown): value is LayoutElement => {
    if (!isObject(value)) {
        return false;
    }

    return typeof value.id === 'string'
        && typeof value.type === 'string'
        && typeof value.x === 'number'
        && typeof value.y === 'number'
        && typeof value.w === 'number'
        && typeof value.h === 'number';
};

const tryParseColor = (value?: string) => {
    if (!value || typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim();
    if (!normalized) {
        return null;
    }

    return normalized;
};

const applyFillColor = (doc: PDFKit.PDFDocument, color?: string) => {
    const parsed = tryParseColor(color);
    if (parsed) {
        doc.fillColor(parsed);
    }
};

const applyStrokeColor = (doc: PDFKit.PDFDocument, color?: string) => {
    const parsed = tryParseColor(color);
    if (parsed) {
        doc.strokeColor(parsed);
    }
};

const resolvePath = (context: Record<string, unknown>, expression: string): unknown => expression.split('.').reduce<unknown>((accumulator, segment) => {
        if (!isObject(accumulator)) {
            return undefined;
        }

        return accumulator[segment];
    }, context);

const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) {
        return '';
    }

    if (value instanceof Date) {
        return value.toLocaleDateString('es-ES');
    }

    if (typeof value === 'number') {
        return value.toLocaleString('es-ES', {
            minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
            maximumFractionDigits: 2
        });
    }

    return String(value);
};

const resolveTextTemplate = (content: string, context: Record<string, unknown>) => content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, expression) => {
        const value = resolvePath(context, expression);
        return value === undefined ? match : formatValue(value);
    });

const buildQrPayload = (employeeId: string, documentType: string, extra?: Record<string, unknown>) => ({
    t: documentType,
    eid: employeeId,
    d: new Date().toISOString(),
    ...(extra || {})
});

const buildQrValue = (element: LayoutQrElement, context: Record<string, unknown>, options: LayoutRenderOptions) => {
    if (element.dataSource === 'custom') {
        return element.value || '';
    }

    if (element.dataSource === 'variable') {
        return formatValue(resolvePath(context, element.value || ''));
    }

    return JSON.stringify(buildQrPayload(options.employeeId, options.documentType, options.qrData));
};

const resolveImageSource = (element: LayoutLogoElement, context: Record<string, unknown>) => {
    if (element.source === 'custom' && element.url) {
        return element.url;
    }

    if (element.source === 'company') {
        const companyLogo = resolvePath(context, 'empresa.logoUrl');
        if (typeof companyLogo === 'string' && companyLogo.trim()) {
            return companyLogo;
        }
    }

    return getLogoPath();
};

const loadImageBuffer = async (source: string | null) => {
    if (!source) {
        return null;
    }

    if (/^https?:\/\//i.test(source)) {
        const response = await fetch(source);
        if (!response.ok) {
            throw new Error(`No se pudo descargar la imagen: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    const normalized = source.replace(/^file:\/\//i, '');
    const candidatePaths = [
        normalized,
        path.isAbsolute(normalized) ? normalized : path.join(process.cwd(), normalized),
        path.join(process.cwd(), 'uploads', normalized.replace(/^\/+/, '')),
        path.join(process.cwd(), 'backend', 'uploads', normalized.replace(/^\/+/, '')),
        path.join(process.cwd(), normalized.replace(/^\/+/, ''))
    ];

    for (const candidate of candidatePaths) {
        if (candidate && fs.existsSync(candidate)) {
            return fs.readFileSync(candidate);
        }
    }

    return null;
};

export const parseLayoutTemplate = (content: string): LayoutTemplate | null => {
    if (!content || typeof content !== 'string') {
        return null;
    }

    try {
        const parsed = JSON.parse(content) as Partial<LayoutTemplate>;
        if (parsed.kind !== 'layout-template' || !Array.isArray(parsed.elements)) {
            return null;
        }

        const elements = parsed.elements.filter(isLayoutElement);
        return {
            kind: 'layout-template',
            version: parsed.version || DEFAULT_LAYOUT_VERSION,
            page: isObject(parsed.page) ? parsed.page as LayoutTemplatePage : {},
            elements
        };
    } catch {
        return null;
    }
};

export const renderLayoutTemplate = async (
    doc: PDFKit.PDFDocument,
    layout: LayoutTemplate,
    context: Record<string, unknown>,
    options: LayoutRenderOptions
) => {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const backgroundColor = tryParseColor(layout.page?.backgroundColor);

    if (backgroundColor) {
        doc.save();
        doc.rect(0, 0, pageWidth, pageHeight).fill(backgroundColor);
        doc.restore();
    }

    const orderedElements = [...layout.elements].sort((left, right) => (left.zIndex || 0) - (right.zIndex || 0));
    const subjectPayload = JSON.stringify(buildQrPayload(options.employeeId, options.documentType, options.qrData));
    doc.info.Subject = subjectPayload;

    for (const element of orderedElements) {
        const x = percentToPoint(element.x, pageWidth);
        const y = percentToPoint(element.y, pageHeight);
        const w = percentToPoint(element.w, pageWidth);
        const h = percentToPoint(element.h, pageHeight);
        const opacity = element.opacity === undefined ? 1 : Math.max(0, Math.min(1, element.opacity));

        doc.save();
        doc.opacity(opacity);

        if (element.type === 'box') {
            const borderWidth = element.borderWidth === undefined ? 1 : element.borderWidth;
            const radius = element.radius || 0;
            const hasFill = Boolean(tryParseColor(element.fillColor));
            const hasStroke = Boolean(tryParseColor(element.borderColor)) && borderWidth > 0;
            const mode = hasFill && hasStroke ? 'DF' : hasFill ? 'F' : hasStroke ? 'S' : undefined;

            if (hasStroke) {
                applyStrokeColor(doc, element.borderColor);
                doc.lineWidth(borderWidth);
            }

            if (hasFill) {
                applyFillColor(doc, element.fillColor);
            }

            if (mode) {
                if (radius > 0) doc.roundedRect(x, y, w, h, radius);
                else doc.rect(x, y, w, h);

                if (mode === 'DF') doc.fillAndStroke();
                if (mode === 'F') doc.fill();
                if (mode === 'S') doc.stroke();
            }

            doc.restore();
            continue;
        }

        if (element.type === 'text' || element.type === 'variable') {
            const value = element.type === 'text'
                ? resolveTextTemplate(element.text, context)
                : `${element.prefix || ''}${formatValue(resolvePath(context, element.variable)) || element.fallback || ''}${element.suffix || ''}`;

            if (!value.trim()) {
                doc.restore();
                continue;
            }

            doc.font(element.fontWeight === 'bold' ? 'Helvetica-Bold' : 'Helvetica');
            doc.fontSize(element.fontSize || 11);
            applyFillColor(doc, element.color || '#0f172a');
            doc.text(value, x, y, {
                width: w,
                height: h,
                align: element.align || 'left',
                lineGap: element.lineHeight || 2
            });
            doc.restore();
            continue;
        }

        if (element.type === 'logo') {
            try {
                const imageSource = resolveImageSource(element, context);
                const imageBuffer = await loadImageBuffer(imageSource);
                if (imageBuffer) {
                    doc.image(imageBuffer, x, y, element.fit === 'cover' ? { cover: [w, h] } : { fit: [w, h], align: 'center', valign: 'center' });
                }
            } catch {
                // Ignore logo rendering errors to avoid breaking the whole PDF.
            }
            doc.restore();
            continue;
        }

        if (element.type === 'qr') {
            try {
                const qrValue = buildQrValue(element, context, options);
                const qrBuffer = await QRCode.toBuffer(qrValue || subjectPayload, {
                    errorCorrectionLevel: 'M',
                    margin: 1,
                    color: {
                        dark: element.color || '#0f172a',
                        light: element.backgroundColor || '#ffffff'
                    }
                });
                doc.image(qrBuffer, x, y, { fit: [w, h] });
            } catch {
                // Ignore QR rendering errors to avoid breaking the whole PDF.
            }
            doc.restore();
        }
    }
};
