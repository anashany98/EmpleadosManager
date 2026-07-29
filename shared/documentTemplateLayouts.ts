export type DocumentLayoutElementType = 'text' | 'variable' | 'box' | 'logo' | 'qr';

interface DocumentLayoutBaseElement {
    id: string;
    type: DocumentLayoutElementType;
    x: number;
    y: number;
    w: number;
    h: number;
    zIndex?: number;
    opacity?: number;
}

export interface DocumentLayoutTextElement extends DocumentLayoutBaseElement {
    type: 'text';
    text: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    color?: string;
    align?: 'left' | 'center' | 'right' | 'justify';
    lineHeight?: number;
}

export interface DocumentLayoutBoxElement extends DocumentLayoutBaseElement {
    type: 'box';
    fillColor?: string;
    borderColor?: string;
    borderWidth?: number;
    radius?: number;
}

export interface DocumentLayoutLogoElement extends DocumentLayoutBaseElement {
    type: 'logo';
    source?: 'company' | 'default' | 'custom';
    url?: string;
    fit?: 'contain' | 'cover';
}

export interface DocumentLayoutQrElement extends DocumentLayoutBaseElement {
    type: 'qr';
    dataSource?: 'document' | 'custom' | 'variable';
    value?: string;
    color?: string;
    backgroundColor?: string;
}

export type DocumentLayoutElement =
    | DocumentLayoutTextElement
    | DocumentLayoutBoxElement
    | DocumentLayoutLogoElement
    | DocumentLayoutQrElement;

export interface CanonicalDocumentLayout {
    kind: 'layout-template';
    version: 1;
    page: {
        backgroundColor: string;
        showGrid: false;
    };
    elements: DocumentLayoutElement[];
}

export interface CanonicalDocumentTemplate {
    name: string;
    layout: CanonicalDocumentLayout;
}

const INK = '#172033';
const MUTED = '#526079';
const ACCENT = '#4f46e5';
const ACCENT_SOFT = '#eef2ff';
const BORDER = '#dbe2ee';
const PAPER = '#ffffff';
const DATA = '#0f766e';
const DATA_SOFT = '#f0fdfa';

const text = (
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    value: string,
    options: Partial<Omit<DocumentLayoutTextElement, keyof DocumentLayoutBaseElement | 'text'>> = {}
): DocumentLayoutTextElement => ({
    id,
    type: 'text',
    x,
    y,
    w,
    h,
    text: value,
    fontSize: 10,
    color: INK,
    ...options
});

const box = (
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    options: Partial<Omit<DocumentLayoutBoxElement, keyof DocumentLayoutBaseElement>> = {}
): DocumentLayoutBoxElement => ({
    id,
    type: 'box',
    x,
    y,
    w,
    h,
    fillColor: PAPER,
    borderColor: BORDER,
    borderWidth: 1,
    radius: 4,
    ...options
});

const layout = (elements: DocumentLayoutElement[]): CanonicalDocumentLayout => ({
    kind: 'layout-template',
    version: 1,
    page: { backgroundColor: PAPER, showGrid: false },
    elements: elements.map((element, index) => ({ ...element, zIndex: index }))
});

const header = (title: string, code: string): DocumentLayoutElement[] => [
    {
        id: 'company-logo',
        type: 'logo',
        source: 'company',
        fit: 'contain',
        x: 8,
        y: 4.5,
        w: 17,
        h: 8
    },
    text('company-name', 29, 4.7, 45, 3.5, '{{empresa.nombre}}', { fontSize: 12, fontWeight: 'bold' }),
    text('company-details', 29, 8.1, 48, 3, 'CIF {{empresa.cif}} · {{empresa.direccion}}', { fontSize: 8, color: MUTED }),
    text('document-code', 77, 5.2, 15, 3, code, { fontSize: 7, fontWeight: 'bold', color: ACCENT, align: 'right' }),
    box('header-rule', 8, 14, 84, 0.28, { fillColor: ACCENT, borderWidth: 0 }),
    text('document-title', 8, 16.7, 84, 5, title, { fontSize: 19, fontWeight: 'bold', align: 'center' })
];

const employeeCard = (y = 24): DocumentLayoutElement[] => [
    box('employee-card', 8, y, 84, 12, { fillColor: ACCENT_SOFT, borderColor: '#c7d2fe' }),
    text('employee-label', 11, y + 1.5, 25, 2.5, 'PERSONA TRABAJADORA', { fontSize: 7, fontWeight: 'bold', color: ACCENT }),
    text('employee-name', 11, y + 4.1, 51, 3.5, '{{empleado.nombreCompleto}}', { fontSize: 12, fontWeight: 'bold' }),
    text('employee-dni', 11, y + 8, 28, 2.7, 'DNI/NIE · {{empleado.dni}}', { fontSize: 8, color: MUTED }),
    text('employee-job', 42, y + 8, 47, 2.7, 'Puesto · {{empleado.puesto}}', { fontSize: 8, color: MUTED })
];

const signatures = (y = 79): DocumentLayoutElement[] => [
    box('company-signature', 8, y, 35, 10, { fillColor: '#fbfcfe' }),
    box('employee-signature', 57, y, 35, 10, { fillColor: '#fbfcfe' }),
    text('company-signature-label', 8, y + 10.7, 35, 2.5, 'Firma de la empresa', { fontSize: 8, fontWeight: 'bold', color: MUTED, align: 'center' }),
    text('employee-signature-label', 57, y + 10.7, 35, 2.5, 'Firma de la persona trabajadora', { fontSize: 8, fontWeight: 'bold', color: MUTED, align: 'center' })
];

const filingFooter = (): DocumentLayoutElement[] => [
    {
        id: 'filing-qr',
        type: 'qr',
        dataSource: 'document',
        x: 46,
        y: 90,
        w: 8,
        h: 5.7,
        color: INK,
        backgroundColor: PAPER
    },
    text('filing-note', 36, 96.1, 28, 2, 'QR de archivo · Expediente digital', { fontSize: 6.5, color: MUTED, align: 'center' })
];

const dateLine = (y = 74): DocumentLayoutElement[] => [
    text('date-line', 8, y, 84, 3, 'En {{firma.ciudad}}, a {{firma.fecha}}.', { fontSize: 9, color: MUTED, align: 'right' })
];

const deliveryLayout = (
    title: string,
    code: string,
    intro: string,
    commitment: string
): CanonicalDocumentLayout => layout([
    ...header(title, code),
    ...employeeCard(),
    text('intro', 9, 40, 82, 5, intro, { fontSize: 10, lineHeight: 2 }),
    box('delivery-card', 8, 47, 84, 19, { fillColor: DATA_SOFT, borderColor: '#99f6e4' }),
    text('delivery-label', 11, 49, 78, 2.5, 'DETALLE DE LA ENTREGA', { fontSize: 7, fontWeight: 'bold', color: DATA }),
    text('delivery-list', 11, 52, 78, 11.5, '{{entrega.listado}}', { fontSize: 10, lineHeight: 3 }),
    text('commitment', 9, 68.5, 82, 5, commitment, { fontSize: 9, color: MUTED, lineHeight: 2 }),
    ...dateLine(75),
    ...signatures(79),
    ...filingFooter()
]);

export const CANONICAL_DOCUMENT_TEMPLATES: Record<string, CanonicalDocumentTemplate> = {
    CERTIFICADO_EMPRESA: {
        name: 'Certificado de empresa',
        layout: layout([
            ...header('CERTIFICADO DE EMPRESA', 'CERT-EMP'),
            ...employeeCard(),
            box('certificate-body', 8, 40, 84, 29, { fillColor: '#fbfcfe' }),
            text('certificate-lead', 11, 43, 78, 4, 'CERTIFICA', { fontSize: 10, fontWeight: 'bold', color: ACCENT }),
            text('certificate-text', 11, 48, 78, 17,
                'Que {{empleado.nombreCompleto}}, con DNI/NIE {{empleado.dni}}, presta servicios en {{empresa.nombre}} desde {{empleado.fechaAlta}}, desempeñando actualmente el puesto de {{empleado.puesto}} mediante contrato {{empleado.tipoContrato}}.',
                { fontSize: 11, align: 'justify', lineHeight: 4 }),
            text('certificate-purpose', 11, 66, 78, 3, 'Se expide el presente certificado a petición de la persona interesada.', { fontSize: 9, color: MUTED }),
            ...dateLine(74),
            ...signatures(),
            ...filingFooter()
        ])
    },
    CERTIFICADO_TRABAJO: {
        name: 'Certificado de trabajo',
        layout: layout([
            ...header('CERTIFICADO DE TRABAJO', 'CERT-TRAB'),
            ...employeeCard(),
            box('certificate-body', 8, 40, 84, 29, { fillColor: '#fbfcfe' }),
            text('certificate-lead', 11, 43, 78, 4, 'HACE CONSTAR', { fontSize: 10, fontWeight: 'bold', color: ACCENT }),
            text('certificate-text', 11, 48, 78, 17,
                'Que {{empleado.nombreCompleto}}, con DNI/NIE {{empleado.dni}}, mantiene relación laboral con {{empresa.nombre}} desde {{empleado.fechaAlta}} y ocupa el puesto de {{empleado.puesto}}. Su salario bruto mensual es de {{empleado.salarioBrutoMensual}}.',
                { fontSize: 11, align: 'justify', lineHeight: 4 }),
            text('certificate-purpose', 11, 66, 78, 3, 'Este documento acredita exclusivamente la situación laboral indicada.', { fontSize: 9, color: MUTED }),
            ...dateLine(74),
            ...signatures(),
            ...filingFooter()
        ])
    },
    CARTA_FORMAL: {
        name: 'Carta formal',
        layout: layout([
            ...header('COMUNICACIÓN FORMAL', 'COM-FORMAL'),
            ...employeeCard(),
            text('subject-label', 8, 40, 16, 3, 'ASUNTO', { fontSize: 7, fontWeight: 'bold', color: ACCENT }),
            text('subject', 8, 43, 84, 4, '{{carta.asunto}}', { fontSize: 13, fontWeight: 'bold' }),
            box('letter-body', 8, 49, 84, 25, { fillColor: '#fbfcfe' }),
            text('letter-content', 11, 52, 78, 19, '{{carta.contenido}}', { fontSize: 10, align: 'justify', lineHeight: 3 }),
            text('letter-closing', 8, 75.5, 40, 3, 'Atentamente, {{firma.autorizante}}', { fontSize: 9, color: MUTED }),
            ...signatures(),
            ...filingFooter()
        ])
    },
    JUSTIFICANTE_AUSENCIA: {
        name: 'Justificante de ausencia',
        layout: layout([
            ...header('JUSTIFICANTE DE AUSENCIA', 'AUS-JUST'),
            ...employeeCard(),
            box('absence-card', 8, 40, 84, 25, { fillColor: DATA_SOFT, borderColor: '#99f6e4' }),
            text('absence-type-label', 11, 42, 25, 2.5, 'TIPO DE AUSENCIA', { fontSize: 7, fontWeight: 'bold', color: DATA }),
            text('absence-type', 11, 45, 78, 4, '{{ausencia.tipo}}', { fontSize: 13, fontWeight: 'bold' }),
            text('absence-period', 11, 51, 50, 3, 'Periodo · {{ausencia.fechaInicio}} — {{ausencia.fechaFin}}', { fontSize: 9 }),
            text('absence-days', 66, 51, 23, 3, 'Días · {{ausencia.dias}}', { fontSize: 9, align: 'right' }),
            text('absence-reason-label', 11, 56, 20, 2.5, 'MOTIVO', { fontSize: 7, fontWeight: 'bold', color: DATA }),
            text('absence-reason', 11, 59, 78, 4, '{{ausencia.motivo}}', { fontSize: 10 }),
            text('absence-copy', 9, 68, 82, 5, 'La empresa deja constancia del periodo indicado a los efectos administrativos oportunos.', { fontSize: 9, color: MUTED }),
            ...dateLine(75),
            ...signatures(),
            ...filingFooter()
        ])
    },
    VACATION_REQUEST: {
        name: 'Solicitud de vacaciones',
        layout: layout([
            ...header('SOLICITUD DE VACACIONES', 'VAC-SOL'),
            ...employeeCard(),
            box('vacation-card', 8, 40, 84, 24, { fillColor: ACCENT_SOFT, borderColor: '#c7d2fe' }),
            text('vacation-period-label', 11, 42, 30, 2.5, 'PERIODO SOLICITADO', { fontSize: 7, fontWeight: 'bold', color: ACCENT }),
            text('vacation-period', 11, 45, 78, 4, '{{vacacion.fechaInicio}} — {{vacacion.fechaFin}}', { fontSize: 13, fontWeight: 'bold' }),
            text('vacation-days', 11, 51, 30, 3, 'Días solicitados · {{vacacion.dias}}', { fontSize: 9 }),
            text('vacation-type', 48, 51, 41, 3, 'Modalidad · {{vacacion.tipo}}', { fontSize: 9, align: 'right' }),
            text('vacation-reason-label', 11, 56, 20, 2.5, 'OBSERVACIONES', { fontSize: 7, fontWeight: 'bold', color: ACCENT }),
            text('vacation-reason', 11, 59, 78, 3.5, '{{vacacion.motivo}}', { fontSize: 9 }),
            text('vacation-copy', 9, 67, 82, 5, 'La solicitud queda sujeta a validación conforme a la planificación y política interna de la empresa.', { fontSize: 9, color: MUTED }),
            ...dateLine(75),
            ...signatures(),
            ...filingFooter()
        ])
    },
    OBRA_EXPENSE_RECEIPT: {
        name: 'Recibí de dietas y gastos de obra',
        layout: layout([
            ...header('RECIBÍ DE DIETAS Y GASTOS', 'OBRA-GASTO'),
            ...employeeCard(),
            box('expense-card', 8, 39, 84, 31, { fillColor: DATA_SOFT, borderColor: '#99f6e4' }),
            text('expense-concept-label', 11, 41, 25, 2.5, 'CONCEPTO', { fontSize: 7, fontWeight: 'bold', color: DATA }),
            text('expense-concept', 11, 44, 78, 4, '{{gasto.concepto}}', { fontSize: 12, fontWeight: 'bold' }),
            text('expense-period', 11, 50, 50, 3, 'Periodo · {{gasto.fechaInicio}} — {{gasto.fechaFin}}', { fontSize: 9 }),
            text('expense-days', 66, 50, 23, 3, 'Días · {{gasto.dias}}', { fontSize: 9, align: 'right' }),
            text('expense-daily-label', 11, 56, 31, 2.5, 'IMPORTE DIARIO', { fontSize: 7, color: MUTED }),
            text('expense-daily', 11, 59, 31, 4, '{{gasto.importeDiario}}', { fontSize: 12, fontWeight: 'bold' }),
            text('expense-total-label', 58, 56, 31, 2.5, 'TOTAL RECIBIDO', { fontSize: 7, color: DATA, align: 'right' }),
            text('expense-total', 58, 59, 31, 4, '{{gasto.importeTotal}}', { fontSize: 15, fontWeight: 'bold', color: DATA, align: 'right' }),
            text('expense-worksite', 11, 66, 78, 3, 'Obra · {{obra.codigo}} — {{obra.nombre}} · {{obra.destino}}', { fontSize: 8, color: MUTED }),
            text('expense-copy', 9, 72, 82, 4, 'La persona firmante declara haber recibido el importe indicado por los conceptos reflejados.', { fontSize: 9, color: MUTED }),
            ...signatures(),
            ...filingFooter()
        ])
    },
    UNIFORM: {
        name: 'Entrega de uniforme',
        layout: deliveryLayout(
            'ACTA DE ENTREGA DE UNIFORME',
            'PRL-UNIF',
            'La empresa entrega a la persona trabajadora las prendas de trabajo que se detallan a continuación.',
            'La persona receptora se compromete a conservar las prendas, utilizarlas durante la actividad laboral y devolverlas cuando proceda.'
        )
    },
    EPI: {
        name: 'Entrega de EPI',
        layout: deliveryLayout(
            'ACTA DE ENTREGA DE EPI',
            'PRL-EPI',
            'La empresa entrega los equipos de protección individual necesarios para el puesto indicado.',
            'La persona receptora declara haber recibido información sobre su uso, mantenimiento y obligación de comunicar cualquier deterioro.'
        )
    },
    ENTREGA_MATERIAL: {
        name: 'Entrega de material',
        layout: deliveryLayout(
            'ACTA DE ENTREGA DE MATERIAL',
            'EQ-MAT',
            'Se entrega a la persona trabajadora el material profesional que se relaciona a continuación.',
            'El material se destina exclusivamente al desempeño profesional y deberá conservarse y devolverse cuando sea requerido.'
        )
    },
    TECH_DEVICE: {
        name: 'Entrega de material tecnológico',
        layout: layout([
            ...header('ENTREGA DE MATERIAL TECNOLÓGICO', 'EQ-TECH'),
            ...employeeCard(),
            box('device-card', 8, 40, 84, 22, { fillColor: DATA_SOFT, borderColor: '#99f6e4' }),
            text('device-label', 11, 42, 30, 2.5, 'DISPOSITIVO', { fontSize: 7, fontWeight: 'bold', color: DATA }),
            text('device-name', 11, 45, 78, 5, '{{entrega.dispositivo}}', { fontSize: 14, fontWeight: 'bold' }),
            text('serial-label', 11, 52, 30, 2.5, 'NÚMERO DE SERIE / IMEI', { fontSize: 7, fontWeight: 'bold', color: DATA }),
            text('serial-number', 11, 55, 78, 4, '{{entrega.numeroSerie}}', { fontSize: 11 }),
            text('device-copy', 9, 65, 82, 8, 'El equipo se entrega para uso profesional. La persona trabajadora se responsabiliza de su custodia, uso diligente y devolución cuando corresponda.', { fontSize: 9, color: MUTED, align: 'justify', lineHeight: 2 }),
            ...dateLine(75),
            ...signatures(),
            ...filingFooter()
        ])
    },
    NDA: {
        name: 'Acuerdo de confidencialidad',
        layout: layout([
            ...header('ACUERDO DE CONFIDENCIALIDAD', 'LEGAL-NDA'),
            ...employeeCard(),
            box('nda-body', 8, 39, 84, 34, { fillColor: '#fbfcfe' }),
            text('nda-heading', 11, 42, 78, 3, 'COMPROMISO DE CONFIDENCIALIDAD', { fontSize: 8, fontWeight: 'bold', color: ACCENT }),
            text('nda-text', 11, 46, 78, 23,
                '{{empresa.nombre}}, con CIF {{empresa.cif}}, y {{empleado.nombreCompleto}}, con DNI/NIE {{empleado.dni}}, acuerdan mantener la confidencialidad de toda información técnica, comercial, financiera, operativa y organizativa conocida durante la relación laboral. La información no podrá comunicarse ni utilizarse para fines distintos de la actividad profesional. Esta obligación se mantendrá durante la relación laboral y después de su finalización.',
                { fontSize: 9.5, align: 'justify', lineHeight: 3 }),
            ...dateLine(75),
            ...signatures(),
            ...filingFooter()
        ])
    },
    RGPD: {
        name: 'Cláusula de protección de datos',
        layout: layout([
            ...header('INFORMACIÓN SOBRE PROTECCIÓN DE DATOS', 'LEGAL-RGPD'),
            ...employeeCard(),
            box('rgpd-body', 8, 39, 84, 34, { fillColor: '#fbfcfe' }),
            text('rgpd-heading', 11, 42, 78, 3, 'TRATAMIENTO DE DATOS PERSONALES', { fontSize: 8, fontWeight: 'bold', color: ACCENT }),
            text('rgpd-text', 11, 46, 78, 23,
                'Responsable: {{empresa.nombre}}, CIF {{empresa.cif}}. Los datos se tratarán para gestionar la relación laboral y cumplir las obligaciones salariales, fiscales, laborales y preventivas. La base jurídica es la ejecución del contrato y el cumplimiento de obligaciones legales. La persona trabajadora podrá ejercer los derechos de acceso, rectificación, supresión, oposición y limitación mediante solicitud dirigida a la empresa.',
                { fontSize: 9.5, align: 'justify', lineHeight: 3 }),
            ...dateLine(75),
            ...signatures(),
            ...filingFooter()
        ])
    }
};

export const getCanonicalTemplateVariables = (template: CanonicalDocumentTemplate): string[] => {
    const variables = new Set<string>();
    const source = JSON.stringify(template.layout);
    for (const match of source.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
        variables.add(match[1]);
    }
    return [...variables];
};
