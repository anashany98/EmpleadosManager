import PDFDocument from 'pdfkit';
import { prisma } from '../../lib/prisma';
import { EncryptionService } from '../EncryptionService';
import { AppError } from '../../utils/AppError';
import { getEmployeeVacationBalanceSummary } from '../VacationBalanceService';
import { StorageService } from '../StorageService';
import { addQRCodeToPDF, buildPdfBuffer, getLogoPath, writeTemplateText } from './DocumentPdfUtils';
import { parseLayoutTemplate, renderLayoutTemplate } from './DocumentLayoutService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { createLogger } from '../../services/LoggerService';

const logger = createLogger('DocumentTemplateService');

export interface TemplateContext {
    empleado: {
        id: string;
        dni: string;
        nombre: string;
        apellidos: string;
        nombreCompleto: string;
        email: string;
        telefono: string;
        direccion: string;
        ciudad: string;
        codigoPostal: string;
        provincia: string;
        puesto: string;
        categoria: string;
        tipoContrato: string;
        fechaAntiguedad: Date | null;
        fechaAlta: Date | null;
        nss: string;
        iban: string;
        salarioBrutoAnual: number;
        salarioBrutoMensual: number;
        cupoVacaciones: number;
        vacacionesUsadas: number;
        vacacionesDisponibles: number;
    };
    empresa: {
        id: string;
        nombre: string;
        cif: string;
        logoUrl: string | null;
        representanteLegal: string | null;
        direccion: string | null;
        codigoPostal: string | null;
        ciudad: string | null;
        provincia: string | null;
        email: string | null;
        telefono: string | null;
    };
    nomina?: {
        id: string;
        mes: number;
        anio: number;
        bruto: number;
        neto: number;
        irpf: number;
        ssEmpresa: number;
        ssTrabajador: number;
        items: Array<{
            concepto: string;
            importe: number;
            tipo: string;
        }>;
    };
    vacaciones?: {
        cupoTotal: number;
        usados: number;
        disponibles: number;
        solicitudesPendientes: number;
    };
    contrato?: {
        tipo: string;
        fechaInicio: Date | null;
        fechaFin: Date | null;
        puesto: string;
        salarioMensual: number;
    };
    entrega?: {
        listado: string;
        dispositivo: string;
        numeroSerie: string;
    };
    firma?: {
        autorizante: string;
        fecha: string;
        ciudad: string;
    };
    carta?: {
        asunto: string;
        contenido: string;
    };
    ausencia?: {
        tipo: string;
        fechaInicio: string;
        fechaFin: string;
        dias: number;
        motivo: string;
    };
    dietas?: {
        concepto: string;
        importe: number;
        fecha: string;
        kilometros: number;
    };
    [key: string]: unknown;
}

export interface ResolvedTemplate {
    name: string;
    type: string;
    content: string;
    variables: string[];
    source: 'company' | 'global' | 'builtin';
    companyId: string | null;
    isDefault: boolean;
}

type TemplateDefinition = Pick<ResolvedTemplate, 'name' | 'type' | 'content' | 'variables'>;

const TEMPLATE_DEFINITIONS: Record<string, TemplateDefinition> = {
    NDA: {
        type: 'NDA',
        name: 'Acuerdo de confidencialidad',
        variables: [
            'empresa.nombre', 'empresa.cif', 'empresa.representanteLegal', 'empresa.ciudad',
            'empleado.nombreCompleto', 'empleado.dni', 'empleado.puesto', 'firma.fecha'
        ],
        content: [
            '# ACUERDO DE CONFIDENCIALIDAD',
            '',
            'De una parte, {{empresa.nombre}}, con CIF {{empresa.cif}}, representada por {{empresa.representanteLegal}}.',
            'De otra parte, {{empleado.nombreCompleto}}, con DNI {{empleado.dni}}, que prestara servicios como {{empleado.puesto}}.',
            '',
            'Ambas partes acuerdan que toda la informacion tecnica, comercial, financiera, operativa y organizativa a la que acceda la persona trabajadora tendra caracter confidencial.',
            '',
            '1. La persona trabajadora se obliga a no divulgar ni utilizar para fines ajenos a la relacion laboral la informacion confidencial.',
            '2. Esta obligacion se mantiene durante la relacion laboral y con posterioridad a su finalizacion.',
            '3. El incumplimiento podra dar lugar a responsabilidades disciplinarias y legales.',
            '',
            'En {{firma.ciudad}}, a {{firma.fecha}}.'
        ].join('\n')
    },
    RGPD: {
        type: 'RGPD',
        name: 'Clausula RGPD',
        variables: [
            'empresa.nombre', 'empresa.cif', 'empresa.direccion', 'empresa.email',
            'empleado.nombreCompleto', 'firma.fecha'
        ],
        content: [
            '# INFORMACION SOBRE PROTECCION DE DATOS',
            '',
            'Responsable del tratamiento: {{empresa.nombre}} - CIF {{empresa.cif}}.',
            'Direccion de contacto: {{empresa.direccion}}. Email: {{empresa.email}}.',
            '',
            'La finalidad del tratamiento es la gestion de la relacion laboral, el cumplimiento de obligaciones salariales, fiscales, laborales y preventivas.',
            'La base juridica es la ejecucion del contrato de trabajo y el cumplimiento de obligaciones legales.',
            'Los datos podran comunicarse a organismos publicos, entidades financieras y proveedores necesarios para la gestion laboral.',
            'La persona trabajadora podra ejercer sus derechos de acceso, rectificacion, supresion, oposicion y limitacion conforme a la normativa vigente.',
            '',
            'He recibido la informacion y comprendo el tratamiento de mis datos personales.',
            '',
            '{{empleado.nombreCompleto}} - {{firma.fecha}}'
        ].join('\n')
    },
    UNIFORM: {
        type: 'UNIFORM',
        name: 'Acta de entrega de uniforme',
        variables: [
            'empresa.nombre', 'empresa.cif', 'empleado.nombreCompleto', 'empleado.dni',
            'entrega.listado', 'firma.ciudad', 'firma.fecha', 'firma.autorizante'
        ],
        content: [
            '# ACTA DE ENTREGA DE UNIFORME',
            '',
            'Empresa: {{empresa.nombre}} - CIF {{empresa.cif}}.',
            'Trabajador/a: {{empleado.nombreCompleto}} - DNI {{empleado.dni}}.',
            '',
            'Se hace entrega del siguiente material:',
            '{{entrega.listado}}',
            '',
            'La persona trabajadora se compromete a utilizar correctamente las prendas entregadas, conservarlas en buen estado y devolverlas cuando proceda.',
            '',
            'En {{firma.ciudad}}, a {{firma.fecha}}.',
            'Autoriza: {{firma.autorizante}}.'
        ].join('\n')
    },
    EPI: {
        type: 'EPI',
        name: 'Acta de entrega de EPI',
        variables: [
            'empresa.nombre', 'empresa.cif', 'empleado.nombreCompleto', 'empleado.dni',
            'entrega.listado', 'firma.ciudad', 'firma.fecha', 'firma.autorizante'
        ],
        content: [
            '# ACTA DE ENTREGA DE EPIS',
            '',
            'Empresa: {{empresa.nombre}} - CIF {{empresa.cif}}.',
            'Trabajador/a: {{empleado.nombreCompleto}} - DNI {{empleado.dni}}.',
            '',
            'La persona trabajadora recibe los siguientes equipos de proteccion individual y declara haber sido informada sobre su uso:',
            '{{entrega.listado}}',
            '',
            'Se compromete a utilizar los EPIS conforme a las instrucciones de seguridad y a comunicar cualquier deterioro o necesidad de reposicion.',
            '',
            'En {{firma.ciudad}}, a {{firma.fecha}}.',
            'Autoriza: {{firma.autorizante}}.'
        ].join('\n')
    },
    TECH_DEVICE: {
        type: 'TECH_DEVICE',
        name: 'Acta de entrega de material tecnologico',
        variables: [
            'empresa.nombre', 'empresa.cif', 'empleado.nombreCompleto', 'empleado.dni',
            'entrega.dispositivo', 'entrega.numeroSerie', 'firma.ciudad', 'firma.fecha'
        ],
        content: [
            '# ACTA DE ENTREGA DE MATERIAL TECNOLOGICO',
            '',
            'Empresa: {{empresa.nombre}} - CIF {{empresa.cif}}.',
            'Trabajador/a: {{empleado.nombreCompleto}} - DNI {{empleado.dni}}.',
            '',
            'Material entregado: {{entrega.dispositivo}}.',
            'Numero de serie / IMEI: {{entrega.numeroSerie}}.',
            '',
            'El equipo se entrega para uso estrictamente profesional. La persona trabajadora se responsabiliza de su custodia, uso adecuado y devolucion al finalizar la relacion laboral.',
            '',
            'En {{firma.ciudad}}, a {{firma.fecha}}.'
        ].join('\n')
    },
    MODEL_145: {
        type: 'MODEL_145',
        name: 'Modelo 145',
        variables: ['empresa.nombre', 'empresa.cif', 'empleado.nombreCompleto', 'empleado.dni'],
        content: 'Plantilla oficial del modelo 145. La personalizacion textual se realiza sobre el formulario PDF oficial.'
    },
    PAYROLL: {
        type: 'PAYROLL',
        name: 'Cabecera de nomina',
        variables: [
            'empresa.nombre', 'empresa.cif', 'empleado.nombreCompleto', 'empleado.dni',
            'nomina.mes', 'nomina.anio', 'nomina.bruto', 'nomina.neto', 'nomina.irpf'
        ],
        content: [
            '# RECIBO DE SALARIOS',
            '',
            'Empresa: {{empresa.nombre}} - CIF {{empresa.cif}}.',
            'Trabajador/a: {{empleado.nombreCompleto}} - DNI {{empleado.dni}}.',
            'Periodo: {{nomina.mes}} / {{nomina.anio}}.',
            '',
            'Bruto: {{nomina.bruto}} EUR',
            'IRPF: {{nomina.irpf}} EUR',
            'Liquido a percibir: {{nomina.neto}} EUR'
        ].join('\n')
    },
    CERTIFICADO_EMPRESA: {
        type: 'CERTIFICADO_EMPRESA',
        name: 'Certificado de empresa',
        variables: [
            'empresa.nombre', 'empresa.cif', 'empresa.direccion', 'empresa.telefono', 'empresa.email',
            'empleado.nombreCompleto', 'empleado.dni', 'empleado.puesto', 'empleado.fechaAlta',
            'empleado.tipoContrato', 'firma.ciudad', 'firma.fecha', 'firma.autorizante'
        ],
        content: [
            '# CERTIFICADO DE EMPRESA',
            '',
            '{{empresa.nombre}}, con CIF {{empresa.cif}}, con domicilio en {{empresa.direccion}} y telefono {{empresa.telefono}},',
            '',
            'CERTIFICA que {{empleado.nombreCompleto}}, con DNI {{empleado.dni}},',
            'trabaja en esta empresa desde el {{empleado.fechaAlta}},',
            'desempenando el puesto de {{empleado.puesto}},',
            'con contrato de {{empleado.tipoContrato}}.',
            '',
            'Este certificado se expide a peticion del interesado para los fines que procedan.',
            '',
            'En {{firma.ciudad}}, a {{firma.fecha}}.',
            '',
            'Firma: {{firma.autorizante}}',
            '{{empresa.nombre}}'
        ].join('\n')
    },
    CERTIFICADO_TRABAJO: {
        type: 'CERTIFICADO_TRABAJO',
        name: 'Certificado de trabajo',
        variables: [
            'empresa.nombre', 'empresa.cif', 'empleado.nombreCompleto', 'empleado.dni',
            'empleado.puesto', 'empleado.fechaAlta', 'empleado.salarioMensual', 'firma.ciudad', 'firma.fecha', 'firma.autorizante'
        ],
        content: [
            '# CERTIFICADO DE TRABAJO',
            '',
            '{{empresa.nombre}}, con CIF {{empresa.cif}},',
            '',
            'CERTIFICA que {{empleado.nombreCompleto}}, con DNI {{empleado.dni}},',
            'es trabajador de esta empresa desde {{empleado.fechaAlta}},',
            'actualmente desempeando el puesto de {{empleado.puesto}},',
            'con un salario bruto mensual de {{empleado.salarioMensual}} EUR.',
            '',
            'Este certificado se expide a peticion del interesado.',
            '',
            'En {{firma.ciudad}}, a {{firma.fecha}}.',
            'Firma: {{firma.autorizante}}'
        ].join('\n')
    },
    CARTA_FORMAL: {
        type: 'CARTA_FORMAL',
        name: 'Carta formal',
        variables: [
            'empresa.nombre', 'empleado.nombreCompleto', 'empleado.dni',
            'firma.ciudad', 'firma.fecha', 'firma.autorizante', 'carta.asunto', 'carta.contenido'
        ],
        content: [
            '{{empresa.nombre}}',
            '',
            'Fecha: {{firma.fecha}}',
            '',
            'A/A: {{empleado.nombreCompleto}}',
            'DNI: {{empleado.dni}}',
            '',
            'Asunto: {{carta.asunto}}',
            '',
            '{{carta.contenido}}',
            '',
            'Atentamente,',
            '',
            '{{firma.autorizante}}',
            '{{empresa.nombre}}'
        ].join('\n')
    },
    JUSTIFICANTE_AUSENCIA: {
        type: 'JUSTIFICANTE_AUSENCIA',
        name: 'Justificante de ausencia',
        variables: [
            'empresa.nombre', 'empresa.cif', 'empleado.nombreCompleto', 'empleado.dni',
            'ausencia.tipo', 'ausencia.fechaInicio', 'ausencia.fechaFin', 'ausencia.dias', 'ausencia.motivo',
            'firma.ciudad', 'firma.fecha', 'firma.autorizante'
        ],
        content: [
            '# JUSTIFICANTE DE AUSENCIA',
            '',
            '{{empresa.nombre}}, con CIF {{empresa.cif}}.',
            '',
            'Certificamos que el/la trabajador/a {{empleado.nombreCompleto}}, con DNI {{empleado.dni}},',
            'ha estado ausente de su puesto de trabajo por el siguiente motivo:',
            '',
            'Tipo de ausencia: {{ausencia.tipo}}',
            'Periodo: del {{ausencia.fechaInicio}} al {{ausencia.fechaFin}}',
            'Dias naturales: {{ausencia.dias}}',
            'Motivo: {{ausencia.motivo}}',
            '',
            'Este justificante se emite a peticion del trabajador/a.',
            '',
            'En {{firma.ciudad}}, a {{firma.fecha}}.',
            'Firma y sello: {{firma.autorizante}}'
        ].join('\n')
    },
    VACATION_REQUEST: {
        type: 'VACATION_REQUEST',
        name: 'Solicitud de vacaciones',
        variables: [
            'empresa.nombre', 'empleado.nombreCompleto', 'empleado.dni', 'empleado.departamento',
            'empleado.puesto', 'vacacion.fechaInicio', 'vacacion.fechaFin', 'vacacion.dias',
            'vacacion.tipo', 'vacacion.motivo', 'firma.ciudad', 'firma.fecha'
        ],
        content: [
            '# SOLICITUD DE VACACIONES',
            '',
            'Empleado: {{empleado.nombreCompleto}}',
            'DNI/NIE: {{empleado.dni}}',
            'Empresa: {{empresa.nombre}}',
            '',
            'Periodo: del {{vacacion.fechaInicio}} al {{vacacion.fechaFin}}',
            'Días solicitados: {{vacacion.dias}}',
            'Tipo: {{vacacion.tipo}}',
            'Motivo: {{vacacion.motivo}}',
            '',
            'Firma del trabajador: ____________________',
            'Firma del responsable: ____________________',
            '',
            'En {{firma.ciudad}}, a {{firma.fecha}}.'
        ].join('\n')
    },
    OBRA_EXPENSE_RECEIPT: {
        type: 'OBRA_EXPENSE_RECEIPT',
        name: 'Recibí de dietas y gastos de obra',
        variables: [
            'empresa.nombre', 'empleado.nombreCompleto', 'empleado.dni',
            'obra.codigo', 'obra.nombre', 'obra.destino', 'gasto.concepto',
            'gasto.fechaInicio', 'gasto.fechaFin', 'gasto.importeDiario',
            'gasto.dias', 'gasto.importeTotal', 'gasto.detalle', 'firma.fecha'
        ],
        content: [
            '# RECIBÍ',
            '',
            'Yo, {{empleado.nombreCompleto}}, con DNI/NIE {{empleado.dni}}, declaro haber recibido de {{empresa.nombre}} la cantidad de {{gasto.importeTotal}}.',
            '',
            'Concepto: {{gasto.concepto}}',
            'Periodo: {{gasto.fechaInicio}} - {{gasto.fechaFin}}',
            'Importe diario: {{gasto.importeDiario}}',
            'Número de días: {{gasto.dias}}',
            'Obra: {{obra.codigo}} - {{obra.nombre}}',
            'Destino: {{obra.destino}}',
            'Detalle: {{gasto.detalle}}',
            '',
            'Firma del trabajador: ____________________',
            '',
            'Emitido el {{firma.fecha}}.'
        ].join('\n')
    },
    FIRMA_DIETAS: {
        type: 'FIRMA_DIETAS',
        name: 'Firma de dietas',
        variables: [
            'empresa.nombre', 'empleado.nombreCompleto', 'empleado.dni',
            'dietas.concepto', 'dietas.importe', 'dietas.fecha', 'dietas.kilometros',
            'firma.ciudad', 'firma.fecha'
        ],
        content: [
            '# SOLICITUD DE DIETAS Y GASTOS',
            '',
            'Empleado: {{empleado.nombreCompleto}} - DNI {{empleado.dni}}',
            'Empresa: {{empresa.nombre}}',
            '',
            'Concepto: {{dietas.concepto}}',
            'Importe: {{dietas.importe}} EUR',
            'Fecha: {{dietas.fecha}}',
            'Kilometros: {{dietas.kilometros}} km',
            '',
            'El abajo firmante declara que los gastos reseados son ciertos y se corresponden con desplazamientos realizados por motivo laboral.',
            '',
            'Firma empleado: _______________',
            '',
            'En {{firma.ciudad}}, a {{firma.fecha}}.'
        ].join('\n')
    },
    ENTREGA_MATERIAL: {
        type: 'ENTREGA_MATERIAL',
        name: 'Entrega de material',
        variables: [
            'empresa.nombre', 'empresa.cif', 'empleado.nombreCompleto', 'empleado.dni',
            'entrega.listado', 'firma.ciudad', 'firma.fecha', 'firma.autorizante'
        ],
        content: [
            '# ACTA DE ENTREGA DE MATERIAL',
            '',
            'Empresa: {{empresa.nombre}} - CIF {{empresa.cif}}.',
            'Trabajador/a: {{empleado.nombreCompleto}} - DNI {{empleado.dni}}.',
            '',
            'Se hace entrega del siguiente material:',
            '{{entrega.listado}}',
            '',
            'La persona trabajadora se compromete a usar correctamente el material entregado y devolverlo cuando proceda.',
            '',
            'En {{firma.ciudad}}, a {{firma.fecha}}.',
            'Autoriza: {{firma.autorizante}}.'
        ].join('\n')
    }
};

const EDITABLE_TEMPLATE_TYPES = ['NDA', 'RGPD', 'UNIFORM', 'EPI', 'TECH_DEVICE', 'CERTIFICADO_EMPRESA', 'CERTIFICADO_TRABAJO', 'CARTA_FORMAL', 'JUSTIFICANTE_AUSENCIA', 'VACATION_REQUEST', 'FIRMA_DIETAS', 'OBRA_EXPENSE_RECEIPT', 'ENTREGA_MATERIAL'];
const OFFICIAL_ONLY_TEMPLATE_TYPES = new Set(['MODEL_145']);

const tryParseArray = (value: string | null | undefined): string[] => {
    if (!value) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch {
        return [];
    }
};

const DOCUMENT_CATEGORY_BY_TYPE: Record<string, string> = {
    NDA: 'CONTRACT',
    RGPD: 'CONTRACT',
    CERTIFICADO_EMPRESA: 'CERTIFICATE',
    CERTIFICADO_TRABAJO: 'CERTIFICATE',
    CARTA_FORMAL: 'OTHER',
    JUSTIFICANTE_AUSENCIA: 'ABSENCE',
    VACATION_REQUEST: 'OTHER',
    FIRMA_DIETAS: 'EXPENSE',
    OBRA_EXPENSE_RECEIPT: 'EXPENSE',
    ENTREGA_MATERIAL: 'OTHER',
    UNIFORM: 'OTHER',
    EPI: 'PRL',
    TECH_DEVICE: 'OTHER'
};

const sanitizeFileName = (value: string) => value
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'documento';

const getDefaultExtraContext = (type: string): Record<string, unknown> => ({
    ausencia: {
        tipo: '',
        fechaInicio: '',
        fechaFin: '',
        dias: '',
        motivo: ''
    },
    carta: {
        asunto: '',
        contenido: ''
    },
    dietas: {
        concepto: '',
        importe: '',
        fecha: '',
        kilometros: ''
    },
    entrega: {
        listado: type === 'ENTREGA_MATERIAL' ? '- Material pendiente de detallar' : '',
        dispositivo: '',
        numeroSerie: ''
    }
});

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

const resolvePath = (context: Record<string, unknown>, path: string): unknown => path.split('.').reduce<unknown>((accumulator, segment) => {
        if (!accumulator || typeof accumulator !== 'object') {
            return undefined;
        }

        return (accumulator as Record<string, unknown>)[segment];
    }, context);

export const CompanyDocumentTemplateService = {
    getCatalog: (): TemplateDefinition[] => EDITABLE_TEMPLATE_TYPES
        .map((type) => TEMPLATE_DEFINITIONS[type])
        .filter(Boolean),

    getDefaultDefinition: (type: string): TemplateDefinition | null => TEMPLATE_DEFINITIONS[type] || null,

    getStoredTemplate: async (type: string, companyId?: string | null) => {
        if (companyId) {
            const companyTemplate = await prisma.documentTemplate.findFirst({
                where: { companyId, type, isActive: true },
                orderBy: { updatedAt: 'desc' }
            });

            if (companyTemplate) {
                return companyTemplate;
            }
        }

        return prisma.documentTemplate.findFirst({
            where: { companyId: null, type, isActive: true },
            orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
        });
    },

    getTemplate: async (type: string, companyId?: string | null): Promise<ResolvedTemplate | null> => {
        const stored = await CompanyDocumentTemplateService.getStoredTemplate(type, companyId);

        if (stored) {
            return {
                name: stored.name,
                type: stored.type,
                content: stored.content,
                variables: tryParseArray(stored.variables),
                source: stored.companyId ? 'company' : 'global',
                companyId: stored.companyId,
                isDefault: stored.isDefault
            };
        }

        const builtin = CompanyDocumentTemplateService.getDefaultDefinition(type);
        if (!builtin) {
            return null;
        }

        return {
            ...builtin,
            source: 'builtin',
            companyId: null,
            isDefault: true
        };
    },

    renderTemplate: (template: string, context: TemplateContext): string => {
        let result = template;

        // 1. Process conditionals: {% if path %}...{% endif %}
        // Supports nested conditionals by processing from innermost to outermost
        let previousResult: string;
        do {
            previousResult = result;
            result = result.replace(
                /\{%\s*if\s+([\w.]+)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g,
                (match, path, content) => {
                    const value = resolvePath(context as Record<string, unknown>, path);
                    // Truthy check: exists, not null/undefined, not empty string, not 0 for numeric context
                    const isTruthy = value !== null && value !== undefined && value !== '';
                    return isTruthy ? content : '';
                }
            );
        } while (result !== previousResult);

        // 2. Process variables with optional date formatting: {{ path }} or {{ path | date('format') }}
        result = result.replace(
            /\{\{\s*([\w.]+)(?:\s*\|\s*date\(['"]([^'"]+)['"]\))?\s*\}\}/g,
            (match, path, dateFormat) => {
                const value = resolvePath(context as Record<string, unknown>, path);

                if (value === undefined || value === null) {
                    return match; // Keep original if not found
                }

                // Apply date formatting if specified and value is a Date or valid date string
                if (dateFormat) {
                    let dateValue: Date | null = null;

                    if (value instanceof Date) {
                        dateValue = value;
                    } else if (typeof value === 'string' || typeof value === 'number') {
                        const parsed = new Date(value);
                        if (!isNaN(parsed.getTime())) {
                            dateValue = parsed;
                        }
                    }

                    if (dateValue) {
                        try {
                            return format(dateValue, dateFormat, { locale: es });
                        } catch (err) {
                            // If date formatting fails, fall back to default format
                            logger.warn({ err }, `Date formatting failed for format "${dateFormat}":`);
                            return formatValue(value);
                        }
                    }
                }

                return formatValue(value);
            }
        );

        // 3. Handle special 'today' keyword for date formatting
        result = result.replace(
            /\{\{\s*today\s*\|\s*date\(['"]([^'"]+)['"]\)\s*\}\}/g,
            (match, dateFormat) => {
                try {
                    return format(new Date(), dateFormat, { locale: es });
                } catch (err) {
                    logger.warn({ err }, `Date formatting failed for format "${dateFormat}":`);
                    return format(new Date(), 'dd/MM/yyyy');
                }
            }
        );

        return result;
    },

    buildContext: async (
        employeeId: string,
        options?: { includePayroll?: boolean; includeVacations?: boolean; extraContext?: Record<string, unknown>; authorName?: string }
    ): Promise<TemplateContext> => {
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: { company: true }
        });

        if (!employee) {
            throw new AppError('Empleado no encontrado', 404);
        }

        const balance = await getEmployeeVacationBalanceSummary(employeeId, new Date().getFullYear());
        const usedDays = balance ? balance.importedUsedDays + balance.approvedUsedDays : employee.vacationDaysTotal ?? 30;
        const totalQuota = balance?.totalEntitledDays ?? employee.vacationDaysTotal ?? 30;
        const availableDays = balance?.availableDays ?? (totalQuota - usedDays);
        const authorName = options?.authorName || employee.company?.legalRep || 'Direccion';
        const city = employee.company?.city || employee.city || 'Palma de Mallorca';

        const context: TemplateContext = {
            empleado: {
                id: employee.id,
                dni: EncryptionService.decrypt(employee.dni) || '',
                nombre: employee.firstName || employee.name || '',
                apellidos: employee.lastName || '',
                nombreCompleto: `${employee.firstName || employee.name || ''} ${employee.lastName || ''}`.trim(),
                email: employee.email || '',
                telefono: employee.phone || '',
                direccion: employee.address || '',
                ciudad: employee.city || '',
                codigoPostal: employee.postalCode || '',
                provincia: employee.province || '',
                puesto: employee.jobTitle || '',
                categoria: employee.category || '',
                tipoContrato: employee.contractType || '',
                fechaAntiguedad: employee.callDate || employee.entryDate || null,
                fechaAlta: employee.entryDate || null,
                nss: EncryptionService.decrypt(employee.socialSecurityNumber) || '',
                iban: EncryptionService.decrypt(employee.iban) || '',
                salarioBrutoAnual: Number(employee.annualGrossSalary) || 0,
                salarioBrutoMensual: Number(employee.monthlyGrossSalary) || 0,
                cupoVacaciones: totalQuota,
                vacacionesUsadas: usedDays,
                vacacionesDisponibles: availableDays
            },
            empresa: {
                id: employee.company?.id || '',
                nombre: employee.company?.name || '',
                cif: employee.company?.cif || '',
                logoUrl: employee.company?.logoUrl || null,
                representanteLegal: employee.company?.legalRep || null,
                direccion: employee.company?.address || null,
                codigoPostal: employee.company?.postalCode || null,
                ciudad: employee.company?.city || null,
                provincia: employee.company?.province || null,
                email: employee.company?.email || null,
                telefono: employee.company?.phone || null
            },
            contrato: {
                tipo: employee.contractType || '',
                fechaInicio: employee.entryDate || null,
                fechaFin: employee.contractEndDate || null,
                puesto: employee.jobTitle || '',
                salarioMensual: Number(employee.monthlyGrossSalary) || 0
            },
            firma: {
                autorizante: authorName,
                fecha: new Date().toLocaleDateString('es-ES'),
                ciudad: city
            }
        };

        if (options?.includePayroll) {
            const latestPayroll = await prisma.payrollRow.findFirst({
                where: { employeeId },
                include: { batch: true, items: true },
                orderBy: { batch: { year: 'desc' } }
            });

            if (latestPayroll) {
                context.nomina = {
                    id: latestPayroll.id,
                    mes: latestPayroll.batch.month,
                    anio: latestPayroll.batch.year,
                    bruto: Number(latestPayroll.bruto) || 0,
                    neto: Number(latestPayroll.neto) || 0,
                    irpf: Number(latestPayroll.irpf) || 0,
                    ssEmpresa: Number(latestPayroll.ssEmpresa) || 0,
                    ssTrabajador: Number(latestPayroll.ssTrabajador) || 0,
                    items: latestPayroll.items.map((item) => ({
                        concepto: item.concept,
                        importe: Number(item.amount) || 0,
                        tipo: item.type
                    }))
                };
            }
        }

        if (options?.includeVacations) {
            const pendingRequests = await prisma.vacation.count({
                where: { employeeId, status: 'PENDING' }
            });

            context.vacaciones = {
                cupoTotal: totalQuota,
                usados: usedDays,
                disponibles: availableDays,
                solicitudesPendientes: pendingRequests
            };
        }

        if (options?.extraContext) {
            Object.assign(context, options.extraContext);
        }

        return context;
    },

    renderPdfFromTemplate: async (options: {
        type: string;
        companyId?: string | null;
        employeeId: string;
        context: Record<string, unknown>;
    }) => {
        const template = await CompanyDocumentTemplateService.getTemplate(options.type, options.companyId ?? null);
        if (!template) throw new AppError('Plantilla no encontrada', 404);

        const layout = parseLayoutTemplate(template.content || '');
        const doc = new PDFDocument({ size: 'A4', margin: layout ? 0 : 50 });
        if (layout) {
            await renderLayoutTemplate(doc, layout, options.context, {
                employeeId: options.employeeId,
                documentType: options.type
            });
        } else {
            await addQRCodeToPDF(doc, { t: options.type }, options.employeeId);
            const logoPath = getLogoPath();
            if (logoPath) doc.image(logoPath, 50, 40, { width: 100 });
            doc.y = logoPath ? 120 : 50;
            const rendered = CompanyDocumentTemplateService.renderTemplate(template.content || '', options.context as TemplateContext);
            writeTemplateText(doc, rendered);
        }
        return { buffer: await buildPdfBuffer(doc), template };
    },

    generateDocumentFromTemplate: async (options: {
        employeeId: string;
        type: string;
        companyId?: string | null;
        authorName?: string;
        extraContext?: Record<string, unknown>;
    }) => {
        const { employeeId, type, companyId = null, authorName, extraContext } = options;
        const template = await CompanyDocumentTemplateService.getTemplate(type, companyId);

        if (!template) {
            throw new AppError('Plantilla no encontrada', 404);
        }

        const mergedExtraContext = {
            ...getDefaultExtraContext(type),
            ...(extraContext || {})
        };
        const context = await CompanyDocumentTemplateService.buildContext(employeeId, {
            includePayroll: true,
            includeVacations: true,
            authorName,
            extraContext: mergedExtraContext
        });
        const documentType = type || template.type;
        const { buffer: pdfBuffer } = await CompanyDocumentTemplateService.renderPdfFromTemplate({
            type: documentType,
            companyId,
            employeeId,
            context: context as Record<string, unknown>
        });
        const safeType = sanitizeFileName(documentType);
        const safeDni = sanitizeFileName(context.empleado.dni || employeeId);
        const originalName = `${safeType}_${safeDni}_${Date.now()}.pdf`;
        const { key } = await StorageService.saveBuffer({
            folder: `documents/EXP_${employeeId}`,
            originalName,
            buffer: pdfBuffer,
            contentType: 'application/pdf'
        });

        try {
            return await prisma.document.create({
                data: {
                    name: template.name,
                    category: DOCUMENT_CATEGORY_BY_TYPE[documentType] || 'OTHER',
                    fileUrl: key,
                    employeeId
                }
            });
        } catch (dbError) {
            await StorageService.deleteFile(key).catch(() => {});
            throw dbError;
        }
    },

    saveTemplate: async (data: {
        companyId?: string | null;
        type: string;
        name: string;
        content: string;
        variables: string[];
        isActive?: boolean;
        isDefault?: boolean;
    }) => {
        const { companyId = null, type, name, content, variables, isActive = true, isDefault = false } = data;

        if (OFFICIAL_ONLY_TEMPLATE_TYPES.has(type)) {
            throw new AppError('MODEL_145 utiliza el formulario oficial y no se puede editar como plantilla', 400);
        }

        const existing = await prisma.documentTemplate.findFirst({
            where: { companyId, type },
            orderBy: { updatedAt: 'desc' }
        });

        if (isDefault && !companyId) {
            await prisma.documentTemplate.updateMany({
                where: { companyId: null, type },
                data: { isDefault: false }
            });
        }

        if (existing) {
            return prisma.documentTemplate.update({
                where: { id: existing.id },
                data: {
                    name,
                    content,
                    variables: JSON.stringify(variables),
                    isActive,
                    isDefault
                }
            });
        }

        return prisma.documentTemplate.create({
            data: {
                companyId,
                type,
                name,
                content,
                variables: JSON.stringify(variables),
                isActive,
                isDefault
            }
        });
    },

    deleteTemplate: async (id: string) => prisma.documentTemplate.delete({ where: { id } }),

    listTemplates: async (options?: { companyId?: string | null; includeGlobal?: boolean }) => {
        const companyId = options?.companyId;
        const includeGlobal = options?.includeGlobal ?? false;

        return prisma.documentTemplate.findMany({
            where: includeGlobal && companyId
                ? { OR: [{ companyId }, { companyId: null }] }
                : { companyId: companyId ?? null },
            include: {
                company: { select: { id: true, name: true, cif: true } }
            },
            orderBy: [{ type: 'asc' }, { updatedAt: 'desc' }]
        });
    }
};
