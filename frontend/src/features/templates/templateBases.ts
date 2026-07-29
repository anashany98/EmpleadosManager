import type {
    CanvasElement,
    LayoutElement,
    LayoutTemplate,
    Template,
    TemplatePreset,
    TemplatePresetElement
} from './components/types';
import { CANONICAL_DOCUMENT_TEMPLATES } from '@shared/documentTemplateLayouts';

export type { CanvasElement, Template } from './components/types';

const DEFAULT_TEXT = '#1e293b';
const MUTED_TEXT = '#475569';
const LIGHT_BG = '#f8fafc';
const BORDER = '#cbd5e1';
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const NON_VISUAL_TEMPLATE_TYPES = new Set(['MODEL_145']);
const SYSTEM_QR_POSITION = { x: 46, y: 90.5, w: 8, h: 5.7 };

export const BACKEND_CATALOG_TEMPLATE_TYPES = [
    'NDA', 'RGPD', 'UNIFORM', 'EPI', 'TECH_DEVICE',
    'CERTIFICADO_EMPRESA', 'CERTIFICADO_TRABAJO', 'CARTA_FORMAL',
    'JUSTIFICANTE_AUSENCIA', 'VACATION_REQUEST',
    'OBRA_EXPENSE_RECEIPT', 'ENTREGA_MATERIAL'
] as const;

export const DEFAULT_TEMPLATES: Template[] = [
    { id: 'certificado_empresa', name: 'Certificado Empresa', type: 'CERTIFICADO_EMPRESA' },
    { id: 'certificado_trabajo', name: 'Certificado Trabajo', type: 'CERTIFICADO_TRABAJO' },
    { id: 'carta_formal', name: 'Carta Formal', type: 'CARTA_FORMAL' },
    { id: 'justificante_ausencia', name: 'Justificante Ausencia', type: 'JUSTIFICANTE_AUSENCIA' },
    { id: 'vacation_request', name: 'Solicitud Vacaciones', type: 'VACATION_REQUEST' },
    { id: 'obra_expense_receipt', name: 'Recibí Dietas / Obra', type: 'OBRA_EXPENSE_RECEIPT' },
    { id: 'uniform', name: 'Entrega Uniforme', type: 'UNIFORM' },
    { id: 'epi', name: 'Entrega EPI', type: 'EPI' },
    { id: 'tech_device', name: 'Material Tecnologico', type: 'TECH_DEVICE' },
    { id: 'nda', name: 'Confidencialidad', type: 'NDA' },
    { id: 'rgpd', name: 'Clausula RGPD', type: 'RGPD' },
    { id: 'entrega_material', name: 'Entrega Material', type: 'ENTREGA_MATERIAL' }
];

export const AVAILABLE_VARIABLES = [
    'empleado.nombreCompleto', 'empleado.nombre', 'empleado.apellidos',
    'empleado.dni', 'empleado.email', 'empleado.telefono', 'empleado.direccion',
    'empleado.puesto', 'empleado.fechaAlta', 'empleado.tipoContrato', 'empleado.nss',
    'empleado.iban', 'empleado.salarioBrutoAnual', 'empleado.salarioBrutoMensual',
    'empleado.cupoVacaciones', 'empleado.vacacionesUsadas', 'empleado.vacacionesDisponibles',
    'empresa.nombre', 'empresa.cif', 'empresa.representanteLegal', 'empresa.direccion',
    'empresa.codigoPostal', 'empresa.ciudad', 'empresa.provincia', 'empresa.email', 'empresa.telefono',
    'contrato.tipo', 'contrato.fechaInicio', 'contrato.fechaFin', 'contrato.puesto', 'contrato.salarioMensual',
    'ausencia.tipo', 'ausencia.fechaInicio', 'ausencia.fechaFin', 'ausencia.dias', 'ausencia.motivo',
    'vacacion.fechaInicio', 'vacacion.fechaFin', 'vacacion.dias', 'vacacion.tipo', 'vacacion.motivo',
    'carta.asunto', 'carta.contenido',
    'dietas.concepto', 'dietas.importe', 'dietas.fecha', 'dietas.kilometros',
    'obra.codigo', 'obra.nombre', 'obra.destino',
    'gasto.concepto', 'gasto.fechaInicio', 'gasto.fechaFin', 'gasto.importeDiario', 'gasto.dias', 'gasto.importeTotal', 'gasto.detalle',
    'entrega.listado', 'entrega.dispositivo', 'entrega.numeroSerie', 'entrega.talla', 'entrega.cantidad',
    'firma.ciudad', 'firma.fecha', 'firma.autorizante',
    'fechaActual'
] as readonly string[];

type IdFactory = (index: number) => string;
const defaultIdFactory: IdFactory = (index) => `el-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 11)}`;

const pxToPercent = (value: number, total: number) => Number(((value / total) * 100).toFixed(4));
const percentToPx = (value: number, total: number) => Number(((value / 100) * total).toFixed(4));
const normalizeAlign = (value?: string): 'left' | 'center' | 'right' => value === 'center' || value === 'right' ? value : 'left';

const extractVariableName = (content: string) => {
    const match = content.trim().match(/^\{\{\s*([\w.]+)\s*\}\}$/);
    return match?.[1] || content.replace(/^\{\{\s*|\s*\}\}$/g, '').trim();
};

const isLayoutTemplate = (value: unknown): value is LayoutTemplate => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const candidate = value as Record<string, unknown>;
    return candidate.kind === 'layout-template' && Array.isArray(candidate.elements);
};

const canvasToLayoutElement = (element: CanvasElement, index: number): LayoutElement => {
    const base = {
        id: element.id,
        x: pxToPercent(element.x, A4_WIDTH_PX),
        y: pxToPercent(element.y, A4_HEIGHT_PX),
        w: pxToPercent(element.width, A4_WIDTH_PX),
        h: pxToPercent(element.height, A4_HEIGHT_PX),
        zIndex: index
    };

    if (element.type === 'variable') {
        return { ...base, type: 'variable' as const, variable: extractVariableName(element.content), fontSize: element.fontSize, fontWeight: element.fontWeight === 'bold' ? 'bold' : 'normal', color: element.color, align: normalizeAlign(element.textAlign) };
    }
    if (element.type === 'qr') {
        return {
            ...base,
            type: 'qr' as const,
            dataSource: element.qrDataSource || 'document',
            value: element.qrValue,
            color: element.color || DEFAULT_TEXT,
            backgroundColor: element.backgroundColor || '#ffffff'
        };
    }
    if (element.type === 'box') {
        return { ...base, type: 'box' as const, fillColor: element.backgroundColor, borderColor: element.borderColor, borderWidth: element.borderWidth };
    }
    if (element.type === 'line') {
        return { ...base, type: 'box' as const, fillColor: element.borderColor || element.color || DEFAULT_TEXT, borderWidth: 0 };
    }
    if (element.type === 'image' || element.type === 'logo') {
        return { ...base, type: 'logo' as const, source: element.src ? 'custom' as const : 'company' as const, url: element.src, fit: 'contain' as const };
    }
    return { ...base, type: 'text' as const, text: element.content, fontSize: element.fontSize, fontWeight: element.fontWeight === 'bold' ? 'bold' : 'normal', color: element.color, align: normalizeAlign(element.textAlign) };
};

const layoutToCanvasElement = (element: LayoutElement, index: number, idFactory: IdFactory): CanvasElement => {
    const base = {
        id: element.id || idFactory(index),
        x: percentToPx(element.x, A4_WIDTH_PX),
        y: percentToPx(element.y, A4_HEIGHT_PX),
        width: percentToPx(element.w, A4_WIDTH_PX),
        height: percentToPx(element.h, A4_HEIGHT_PX)
    };

    if (element.type === 'variable') {
        return { ...base, type: 'variable' as const, content: `{{${element.variable}}}`, fontSize: element.fontSize || 12, fontWeight: element.fontWeight || 'normal', color: element.color || DEFAULT_TEXT, textAlign: normalizeAlign(element.align) };
    }
    if (element.type === 'box') {
        return { ...base, type: 'box' as const, content: '', backgroundColor: element.fillColor, borderColor: element.borderColor, borderWidth: element.borderWidth ?? (element.borderColor ? 1 : 0) };
    }
    if (element.type === 'logo') {
        return { ...base, type: 'logo' as const, content: '', src: element.url };
    }
    if (element.type === 'qr') {
        return {
            ...base,
            type: 'qr' as const,
            content: '',
            qrDataSource: element.dataSource || 'document',
            qrValue: element.value,
            color: element.color || DEFAULT_TEXT,
            backgroundColor: element.backgroundColor || '#ffffff',
            locked: (element.dataSource || 'document') === 'document'
        };
    }
    return { ...base, type: 'text' as const, content: element.text, fontSize: element.fontSize || 12, fontWeight: element.fontWeight || 'normal', color: element.color || DEFAULT_TEXT, textAlign: normalizeAlign(element.align) };
};

const isCanvasElement = (value: unknown): value is CanvasElement => {
    if (!value || typeof value !== 'object') return false;
    const el = value as Record<string, unknown>;
    return Boolean(el.id && el.type && typeof el.x === 'number' && typeof el.y === 'number');
};

export const createSystemQrElement = (
    idFactory: IdFactory = defaultIdFactory,
    index = 0
): CanvasElement => ({
    id: idFactory(index),
    type: 'qr',
    x: percentToPx(SYSTEM_QR_POSITION.x, A4_WIDTH_PX),
    y: percentToPx(SYSTEM_QR_POSITION.y, A4_HEIGHT_PX),
    width: percentToPx(SYSTEM_QR_POSITION.w, A4_WIDTH_PX),
    height: percentToPx(SYSTEM_QR_POSITION.h, A4_HEIGHT_PX),
    content: '',
    qrDataSource: 'document',
    color: DEFAULT_TEXT,
    backgroundColor: '#ffffff',
    locked: true
});

const ensureSystemQr = (elements: CanvasElement[], idFactory: IdFactory): CanvasElement[] => {
    const existingIndex = elements.findIndex((element) =>
        element.type === 'qr' && (element.qrDataSource || 'document') === 'document'
    );
    if (existingIndex < 0) {
        return [...elements, createSystemQrElement(idFactory, elements.length)];
    }
    return elements.map((element, index) =>
        index === existingIndex ? { ...element, qrDataSource: 'document', locked: true } : element
    );
};

export const serializeTemplateContent = (elements: CanvasElement[]): string => {
    const layout: LayoutTemplate = {
        kind: 'layout-template',
        version: 1,
        page: { backgroundColor: '#ffffff', showGrid: false },
        elements: elements.map(canvasToLayoutElement)
    };
    return JSON.stringify(layout);
};

const parseSavedElements = (content?: string, idFactory: IdFactory = defaultIdFactory): CanvasElement[] | null => {
    if (!content) return null;
    try {
        const parsed = JSON.parse(content);
        if (isLayoutTemplate(parsed)) {
            return parsed.elements.map((el, i) => layoutToCanvasElement(el, i, idFactory));
        }
        return Array.isArray(parsed) && parsed.every(isCanvasElement) ? parsed : null;
    } catch {
        return null;
    }
};

const p = (percent: number, total: number) => (percent / 100) * total;

const title = (text: string): TemplatePresetElement => ({
    type: 'text', x: 8, y: 5, w: 84, h: 8, text, fontSize: 22, fontWeight: 'bold', align: 'center'
});

const companyHeader: TemplatePresetElement[] = [
    { type: 'text', x: 10, y: 16, w: 55, h: 4, text: '{{empresa.nombre}}', fontSize: 12, fontWeight: 'bold' },
    { type: 'text', x: 10, y: 20, w: 55, h: 4, text: 'CIF: {{empresa.cif}}', fontSize: 10 },
    { type: 'text', x: 10, y: 24, w: 55, h: 4, text: '{{empresa.direccion}}', fontSize: 10 },
    { type: 'box', x: 72, y: 15, w: 18, h: 10, fillColor: '#ffffff', borderColor: '#e2e8f0' },
    { type: 'text', x: 72, y: 19, w: 18, h: 3, text: 'LOGO', fontSize: 10, align: 'center', color: '#94a3b8' }
];

const employeeBlock = (y: number): TemplatePresetElement[] => [
    { type: 'box', x: 10, y, w: 80, h: 13, fillColor: LIGHT_BG, borderColor: '#e2e8f0' },
    { type: 'text', x: 13, y: y + 2, w: 74, h: 4, text: 'Trabajador/a: {{empleado.nombreCompleto}}', fontSize: 12, fontWeight: 'bold' },
    { type: 'text', x: 13, y: y + 6, w: 35, h: 4, text: 'DNI: {{empleado.dni}}', fontSize: 10 },
    { type: 'text', x: 50, y: y + 6, w: 37, h: 4, text: 'Puesto: {{empleado.puesto}}', fontSize: 10 }
];

const dualSignatures = (y = 78): TemplatePresetElement[] => [
    { type: 'box', x: 10, y, w: 34, h: 12, fillColor: '#ffffff', borderColor: BORDER },
    { type: 'text', x: 10, y: y + 13, w: 34, h: 4, text: 'Firma empresa', fontSize: 10, fontWeight: 'bold', align: 'center', color: MUTED_TEXT },
    { type: 'box', x: 56, y, w: 34, h: 12, fillColor: '#ffffff', borderColor: BORDER },
    { type: 'text', x: 56, y: y + 13, w: 34, h: 4, text: 'Firma trabajador', fontSize: 10, fontWeight: 'bold', align: 'center', color: MUTED_TEXT }
];

const bodyBox = (y: number, h: number, text: string): TemplatePresetElement[] => [
    { type: 'box', x: 10, y, w: 80, h, fillColor: '#ffffff', borderColor: '#e2e8f0' },
    { type: 'text', x: 13, y: y + 3, w: 74, h: h - 6, text, fontSize: 11, align: 'left' }
];

export const TEMPLATE_PRESETS: Record<string, TemplatePreset> = {
    CERTIFICADO_EMPRESA: {
        name: 'Certificado de Empresa',
        elements: [
            title('CERTIFICADO DE EMPRESA'), ...companyHeader, ...employeeBlock(32),
            ...bodyBox(50, 18, 'CERTIFICA que {{empleado.nombreCompleto}}, con DNI {{empleado.dni}}, trabaja en esta empresa desde {{empleado.fechaAlta}}, desempenando el puesto de {{empleado.puesto}} con contrato {{empleado.tipoContrato}}.'),
            { type: 'text', x: 10, y: 72, w: 80, h: 4, text: 'En {{firma.ciudad}}, a {{firma.fecha}}.', fontSize: 11 },
            ...dualSignatures()
        ]
    },
    CERTIFICADO_TRABAJO: {
        name: 'Certificado de Trabajo',
        elements: [
            title('CERTIFICADO DE TRABAJO'), ...companyHeader, ...employeeBlock(32),
            ...bodyBox(50, 17, 'CERTIFICA que {{empleado.nombreCompleto}} presta servicios en {{empresa.nombre}} desde {{empleado.fechaAlta}}, actualmente en el puesto de {{empleado.puesto}}, con salario bruto mensual de {{empleado.salarioBrutoMensual}} EUR.'),
            { type: 'text', x: 10, y: 71, w: 80, h: 4, text: 'Este certificado se expide a peticion de la persona interesada.', fontSize: 11 },
            ...dualSignatures()
        ]
    },
    CARTA_FORMAL: {
        name: 'Carta Formal',
        elements: [
            { type: 'text', x: 10, y: 6, w: 45, h: 5, text: '{{empresa.nombre}}', fontSize: 14, fontWeight: 'bold' },
            { type: 'text', x: 10, y: 11, w: 45, h: 4, text: '{{empresa.direccion}}', fontSize: 10 },
            { type: 'text', x: 65, y: 7, w: 25, h: 4, text: 'Fecha: {{firma.fecha}}', fontSize: 10, align: 'right' },
            ...employeeBlock(22),
            { type: 'text', x: 10, y: 40, w: 80, h: 5, text: 'Asunto: {{carta.asunto}}', fontSize: 14, fontWeight: 'bold' },
            ...bodyBox(48, 27, '{{carta.contenido}}'),
            { type: 'text', x: 10, y: 81, w: 50, h: 4, text: 'Atentamente,', fontSize: 11 },
            { type: 'text', x: 10, y: 88, w: 50, h: 4, text: '{{firma.autorizante}}', fontSize: 12, fontWeight: 'bold' },
            { type: 'text', x: 10, y: 92, w: 50, h: 4, text: '{{empresa.nombre}}', fontSize: 10 }
        ]
    },
    JUSTIFICANTE_AUSENCIA: {
        name: 'Justificante de Ausencia',
        elements: [
            title('JUSTIFICANTE DE AUSENCIA'), ...companyHeader, ...employeeBlock(32),
            { type: 'text', x: 12, y: 52, w: 76, h: 4, text: 'Tipo de ausencia: {{ausencia.tipo}}', fontSize: 12, fontWeight: 'bold' },
            { type: 'text', x: 12, y: 57, w: 76, h: 4, text: 'Periodo: del {{ausencia.fechaInicio}} al {{ausencia.fechaFin}}', fontSize: 11 },
            { type: 'text', x: 12, y: 62, w: 76, h: 4, text: 'Dias naturales: {{ausencia.dias}}', fontSize: 11 },
            ...bodyBox(67, 10, 'Motivo: {{ausencia.motivo}}'),
            ...dualSignatures(81)
        ]
    },
    VACATION_REQUEST: {
        name: 'Solicitud de Vacaciones',
        elements: [
            title('SOLICITUD DE VACACIONES'), ...companyHeader, ...employeeBlock(30),
            { type: 'box', x: 10, y: 47, w: 80, h: 22, fillColor: LIGHT_BG, borderColor: '#e2e8f0' },
            { type: 'text', x: 13, y: 50, w: 74, h: 4, text: 'Periodo: {{vacacion.fechaInicio}} - {{vacacion.fechaFin}}', fontSize: 12, fontWeight: 'bold' },
            { type: 'text', x: 13, y: 55, w: 35, h: 4, text: 'Días: {{vacacion.dias}}', fontSize: 11 },
            { type: 'text', x: 52, y: 55, w: 35, h: 4, text: 'Tipo: {{vacacion.tipo}}', fontSize: 11 },
            { type: 'text', x: 13, y: 61, w: 74, h: 5, text: 'Motivo: {{vacacion.motivo}}', fontSize: 11 },
            ...dualSignatures(80)
        ]
    },
    OBRA_EXPENSE_RECEIPT: {
        name: 'Recibí de Dietas y Gastos de Obra',
        elements: [
            title('RECIBÍ'), ...companyHeader, ...employeeBlock(28),
            { type: 'box', x: 10, y: 45, w: 80, h: 30, fillColor: LIGHT_BG, borderColor: '#e2e8f0' },
            { type: 'text', x: 13, y: 48, w: 74, h: 4, text: 'Concepto: {{gasto.concepto}}', fontSize: 12, fontWeight: 'bold' },
            { type: 'text', x: 13, y: 53, w: 74, h: 4, text: 'Periodo: {{gasto.fechaInicio}} - {{gasto.fechaFin}}', fontSize: 11 },
            { type: 'text', x: 13, y: 58, w: 35, h: 4, text: 'Importe diario: {{gasto.importeDiario}}', fontSize: 11 },
            { type: 'text', x: 52, y: 58, w: 35, h: 4, text: 'Días: {{gasto.dias}}', fontSize: 11 },
            { type: 'text', x: 13, y: 63, w: 74, h: 4, text: 'Total: {{gasto.importeTotal}}', fontSize: 13, fontWeight: 'bold' },
            { type: 'text', x: 13, y: 68, w: 74, h: 4, text: 'Obra: {{obra.codigo}} - {{obra.nombre}} · Destino: {{obra.destino}}', fontSize: 10 },
            ...dualSignatures(82)
        ]
    },
    UNIFORM: {
        name: 'Acta de Entrega de Uniforme',
        elements: [
            title('ACTA DE ENTREGA DE UNIFORME'), ...companyHeader, ...employeeBlock(31),
            ...bodyBox(48, 19, 'Se hace entrega del siguiente material:\n\n{{entrega.listado}}'),
            { type: 'text', x: 10, y: 70, w: 80, h: 5, text: 'La persona trabajadora se compromete a conservar y devolver las prendas cuando proceda.', fontSize: 10 },
            ...dualSignatures(81)
        ]
    },
    EPI: {
        name: 'Acta de Entrega de EPI',
        elements: [
            title('ACTA DE ENTREGA DE EPI'), ...companyHeader, ...employeeBlock(31),
            ...bodyBox(48, 20, 'La persona trabajadora recibe los siguientes equipos de proteccion individual y declara haber sido informada sobre su uso:\n\n{{entrega.listado}}'),
            { type: 'text', x: 10, y: 71, w: 80, h: 5, text: 'Debe utilizarlos conforme a las instrucciones de seguridad y comunicar cualquier deterioro.', fontSize: 10 },
            ...dualSignatures(82)
        ]
    },
    TECH_DEVICE: {
        name: 'Acta de Entrega de Material Tecnologico',
        elements: [
            title('ACTA DE ENTREGA DE MATERIAL TECNOLOGICO'), ...companyHeader, ...employeeBlock(31),
            { type: 'box', x: 10, y: 49, w: 80, h: 15, fillColor: LIGHT_BG, borderColor: '#e2e8f0' },
            { type: 'text', x: 13, y: 52, w: 74, h: 4, text: 'Dispositivo: {{entrega.dispositivo}}', fontSize: 12, fontWeight: 'bold' },
            { type: 'text', x: 13, y: 57, w: 74, h: 4, text: 'Numero de serie / IMEI: {{entrega.numeroSerie}}', fontSize: 11 },
            ...bodyBox(68, 8, 'El equipo se entrega para uso profesional. La persona trabajadora se responsabiliza de su custodia y devolucion.'),
            ...dualSignatures(82)
        ]
    },
    NDA: {
        name: 'Acuerdo de Confidencialidad',
        elements: [
            title('ACUERDO DE CONFIDENCIALIDAD'), ...companyHeader, ...employeeBlock(31),
            ...bodyBox(48, 29, '{{empresa.nombre}}, con CIF {{empresa.cif}}, y {{empleado.nombreCompleto}}, con DNI {{empleado.dni}}, acuerdan que toda informacion tecnica, comercial, financiera, operativa u organizativa conocida durante la relacion laboral tendra caracter confidencial.\n\nLa obligacion de confidencialidad se mantiene durante la relacion laboral y despues de su finalizacion.'),
            { type: 'text', x: 10, y: 80, w: 80, h: 4, text: 'En {{firma.ciudad}}, a {{firma.fecha}}.', fontSize: 11 },
            ...dualSignatures(82)
        ]
    },
    RGPD: {
        name: 'Clausula RGPD',
        elements: [
            title('INFORMACION SOBRE PROTECCION DE DATOS'), ...companyHeader, ...employeeBlock(31),
            ...bodyBox(48, 29, 'Responsable del tratamiento: {{empresa.nombre}} - CIF {{empresa.cif}}.\n\nLa finalidad del tratamiento es la gestion de la relacion laboral y el cumplimiento de obligaciones salariales, fiscales, laborales y preventivas. La persona trabajadora puede ejercer sus derechos de acceso, rectificacion, supresion, oposicion y limitacion.'),
            { type: 'text', x: 10, y: 80, w: 80, h: 4, text: 'Recibido por {{empleado.nombreCompleto}} en fecha {{firma.fecha}}.', fontSize: 11 },
            ...dualSignatures(82)
        ]
    },
    ENTREGA_MATERIAL: {
        name: 'Entrega de Material',
        elements: [
            title('ACTA DE ENTREGA DE MATERIAL'), ...companyHeader, ...employeeBlock(31),
            ...bodyBox(48, 19, 'Se hace entrega del siguiente material:\n\n{{entrega.listado}}'),
            { type: 'text', x: 10, y: 70, w: 80, h: 5, text: 'La persona trabajadora se compromete a usar correctamente el material entregado.', fontSize: 10 },
            ...dualSignatures(81)
        ]
    }
};

export const convertPresetToElements = (preset: TemplatePreset, idFactory: IdFactory = defaultIdFactory): CanvasElement[] =>
    preset.elements.map((el, i) => ({
        id: idFactory(i),
        type: el.type,
        x: p(el.x, A4_WIDTH_PX),
        y: p(el.y, A4_HEIGHT_PX),
        width: p(el.w, A4_WIDTH_PX),
        height: p(el.h, A4_HEIGHT_PX),
        content: el.text || '',
        fontSize: el.fontSize || 12,
        fontWeight: el.fontWeight || 'normal',
        textAlign: el.align || 'left',
        backgroundColor: el.fillColor,
        borderColor: el.borderColor,
        borderWidth: el.borderWidth ?? (el.borderColor ? 1 : 0),
        color: el.color || DEFAULT_TEXT
    }));

const stripMarkdownHeading = (content: string, fallback: string) => {
    const lines = content.split(/\r?\n/);
    const headingIndex = lines.findIndex((line) => line.trim().startsWith('#'));
    const heading = headingIndex >= 0 ? lines[headingIndex].replace(/^#+\s*/, '').trim() : fallback;
    const body = lines.filter((_, i) => i !== headingIndex).join('\n').replace(/\*\*/g, '').trim();
    return { heading: heading || fallback, body };
};

const createElementsFromTextTemplate = (
    template: Pick<Template, 'name' | 'content'>,
    idFactory: IdFactory = defaultIdFactory
): CanvasElement[] => {
    const { heading, body } = stripMarkdownHeading(template.content || '', template.name || 'Documento');
    return convertPresetToElements({
        name: template.name || heading,
        elements: [
            title(heading.toUpperCase()), ...companyHeader,
            ...bodyBox(30, 42, body || 'Anade aqui el contenido principal del documento.'),
            { type: 'text', x: 10, y: 75, w: 80, h: 4, text: 'En {{firma.ciudad}}, a {{firma.fecha}}.', fontSize: 11 },
            ...dualSignatures(82)
        ]
    }, idFactory);
};

export const createElementsForTemplate = (
    template: Pick<Template, 'type' | 'name' | 'content'>,
    idFactory: IdFactory = defaultIdFactory
): CanvasElement[] => {
    const saved = parseSavedElements(template.content, idFactory);
    if (saved) return ensureSystemQr(saved, idFactory);
    const canonical = CANONICAL_DOCUMENT_TEMPLATES[template.type];
    if (canonical) {
        return ensureSystemQr(
            canonical.layout.elements.map((element, index) =>
                layoutToCanvasElement(element as LayoutElement, index, idFactory)
            ),
            idFactory
        );
    }
    const preset = TEMPLATE_PRESETS[template.type];
    if (preset) return ensureSystemQr(convertPresetToElements(preset, idFactory), idFactory);
    if (template.content) return ensureSystemQr(createElementsFromTextTemplate(template, idFactory), idFactory);
    return ensureSystemQr([], idFactory);
};

const getTemplatePriority = (t: Template) => {
    if (t.companyId) return 3;
    if (Object.prototype.hasOwnProperty.call(t, 'companyId') || Object.prototype.hasOwnProperty.call(t, 'isDefault')) return 2;
    return 1;
};

const getUpdatedAtTimestamp = (t: Template) => {
    if (!t.updatedAt) return Number.NEGATIVE_INFINITY;
    const parsed = Date.parse(t.updatedAt);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
};

const isPreferredTemplate = (candidate: Template, current: Template) => {
    const cp = getTemplatePriority(candidate);
    const cr = getTemplatePriority(current);
    if (cp !== cr) return cp > cr;
    const cu = getUpdatedAtTimestamp(candidate);
    const ru = getUpdatedAtTimestamp(current);
    if (cu !== ru) return cu > ru;
    return true;
};

export const resolveTemplatesByType = <T extends Template>(templates: T[]): T[] => {
    const resolved = new Map<string, T>();
    templates.forEach((template) => {
        const current = resolved.get(template.type);
        if (!current || isPreferredTemplate(template, current)) {
            resolved.set(template.type, template);
        }
    });
    return Array.from(resolved.values());
};

export const mergeTemplatesWithDefaults = (remoteTemplates: Template[]): Template[] => {
    const resolved = resolveTemplatesByType(remoteTemplates);
    const remoteByType = new Map(resolved.map((t) => [t.type, t]));
    const merged = DEFAULT_TEMPLATES.map((t) => ({
        ...t,
        ...remoteByType.get(t.type),
        id: remoteByType.get(t.type)?.id || t.id
    }));
    const knownTypes = new Set(DEFAULT_TEMPLATES.map((t) => t.type));
    const unknownRemote = resolved
        .filter((t) => !knownTypes.has(t.type) && !NON_VISUAL_TEMPLATE_TYPES.has(t.type))
        .map((t) => ({ ...t, id: t.id || t.type.toLowerCase() }));
    return [...merged, ...unknownRemote];
};
