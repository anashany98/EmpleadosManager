export type ElementType = 'text' | 'variable' | 'box' | 'line' | 'image' | 'logo';

export interface CanvasElement {
    id: string;
    type: ElementType;
    x: number;
    y: number;
    width: number;
    height: number;
    content: string;
    fontSize?: number;
    fontWeight?: string;
    color?: string;
    textAlign?: 'left' | 'center' | 'right';
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    src?: string;
    rotation?: number;
}

export interface Template {
    id: string;
    name: string;
    type: string;
    content?: string;
    companyId?: string | null;
    isDefault?: boolean;
    updatedAt?: string;
}

export interface TemplatePresetElement {
    type: ElementType;
    x: number;
    y: number;
    w: number;
    h: number;
    text?: string;
    fontSize?: number;
    fontWeight?: string;
    align?: 'left' | 'center' | 'right';
    fillColor?: string;
    borderColor?: string;
    borderWidth?: number;
    color?: string;
}

export interface TemplatePreset {
    name: string;
    elements: TemplatePresetElement[];
}

export type LayoutElementType = 'text' | 'variable' | 'box' | 'logo' | 'qr';

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

interface LayoutTextElement extends LayoutBaseElement {
    type: 'text';
    text: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    color?: string;
    align?: 'left' | 'center' | 'right' | 'justify';
    lineHeight?: number;
}

interface LayoutVariableElement extends LayoutBaseElement {
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

interface LayoutBoxElement extends LayoutBaseElement {
    type: 'box';
    fillColor?: string;
    borderColor?: string;
    borderWidth?: number;
    radius?: number;
}

interface LayoutLogoElement extends LayoutBaseElement {
    type: 'logo';
    source?: 'company' | 'default' | 'custom';
    url?: string;
    fit?: 'contain' | 'cover';
}

interface LayoutQrElement extends LayoutBaseElement {
    type: 'qr';
    dataSource?: 'document' | 'custom' | 'variable';
    value?: string;
    color?: string;
    backgroundColor?: string;
}

export type LayoutElement = LayoutTextElement | LayoutVariableElement | LayoutBoxElement | LayoutLogoElement | LayoutQrElement;

export interface LayoutTemplate {
    kind: 'layout-template';
    version: number;
    page?: {
        backgroundColor?: string;
        showGrid?: boolean;
    };
    elements: LayoutElement[];
}

export interface Employee {
    id: string;
    dni: string;
    nombreCompleto: string;
    puesto: string;
    fechaAlta: string;
    tipoContrato?: string;
}
