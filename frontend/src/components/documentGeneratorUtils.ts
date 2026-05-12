import {
    DEFAULT_TEMPLATES,
    mergeTemplatesWithDefaults,
    resolveTemplatesByType,
    type Template
} from '../features/templates/templateBases';

export interface InventorySelection {
    id?: string;
    name: string;
    size?: string;
    quantity?: number;
    detail?: string;
    serialNumber?: string;
}

export interface DocumentGeneratorExtraData {
    ausencia?: {
        tipo: string;
        fechaInicio: string;
        fechaFin: string;
        dias: number | string;
        motivo: string;
    };
    carta?: {
        asunto: string;
        contenido: string;
    };
    dietas?: {
        concepto: string;
        importe: number | string;
        fecha: string;
        kilometros: number | string;
    };
}

interface GenerationRequestInput {
    docType: string;
    employeeId: string;
    authorName: string;
    selectedItems?: InventorySelection[];
    selectedTechItem?: InventorySelection | null;
    extraData?: DocumentGeneratorExtraData;
}

interface GenerationRequest {
    endpoint: string;
    payload: Record<string, unknown>;
}

export interface TemplateCardOption {
    type: string;
    name: string;
    source: 'official' | 'builtin' | 'global' | 'company';
    hasStoredTemplate: boolean;
}

interface StoredTemplateLike extends Template {
    companyId?: string | null;
    isDefault?: boolean;
    updatedAt?: string;
}

export const STANDARD_DOCUMENT_TYPES = [
    'UNIFORM',
    'EPI',
    'TECH_DEVICE',
    'ENTREGA_MATERIAL',
    'MODEL_145',
    'NDA',
    'RGPD',
    'CERTIFICADO_EMPRESA',
    'CERTIFICADO_TRABAJO',
    'CARTA_FORMAL',
    'JUSTIFICANTE_AUSENCIA',
    'FIRMA_DIETAS'
] as const;

const STANDARD_DOCUMENT_TYPE_SET = new Set<string>(STANDARD_DOCUMENT_TYPES);
const OFFICIAL_ONLY_TYPES = new Set(['MODEL_145']);
const STANDARD_TEMPLATE_NAME_BY_TYPE = new Map<string, string>([
    ...DEFAULT_TEMPLATES.map((template) => [template.type, template.name]),
    ['MODEL_145', 'Modelo 145 oficial']
]);

const buildGenericTemplatePayload = (
    basePayload: Record<string, unknown>,
    docType: string,
    data?: Record<string, unknown>
): GenerationRequest => ({
    endpoint: '/document-templates/generate',
    payload: {
        ...basePayload,
        templateType: docType,
        ...(data ? { data } : {})
    }
});

export const extractApiArray = <T,>(response: unknown): T[] => {
    if (Array.isArray(response)) return response as T[];

    const data = (response as { data?: unknown } | null)?.data;
    if (Array.isArray(data)) return data as T[];

    const nestedData = (data as { data?: unknown } | null)?.data;
    return Array.isArray(nestedData) ? nestedData as T[] : [];
};

export const resolveDocumentGeneratorTemplates = (
    catalogResponse: unknown,
    storedResponse: unknown
): { standardTemplates: TemplateCardOption[]; customTemplates: TemplateCardOption[] } => {
    const catalogTemplates = extractApiArray<StoredTemplateLike>(catalogResponse);
    const storedTemplates = resolveTemplatesByType(extractApiArray<StoredTemplateLike>(storedResponse));
    const mergedTemplates = mergeTemplatesWithDefaults([...catalogTemplates, ...storedTemplates]);
    const mergedByType = new Map(mergedTemplates.map((template) => [template.type, template]));
    const storedByType = new Map(storedTemplates.map((template) => [template.type, template]));

    const standardTemplates = STANDARD_DOCUMENT_TYPES.map((type) => {
        if (OFFICIAL_ONLY_TYPES.has(type)) {
            return {
                type,
                name: STANDARD_TEMPLATE_NAME_BY_TYPE.get(type) || type,
                source: 'official' as const,
                hasStoredTemplate: false
            };
        }

        const storedTemplate = storedByType.get(type);
        return {
            type,
            name: STANDARD_TEMPLATE_NAME_BY_TYPE.get(type) || mergedByType.get(type)?.name || type,
            source: storedTemplate?.companyId
                ? 'company'
                : storedTemplate
                    ? 'global'
                    : 'builtin',
            hasStoredTemplate: Boolean(storedTemplate)
        };
    });

    const customTemplates = storedTemplates
        .filter((template) => !STANDARD_DOCUMENT_TYPE_SET.has(template.type) && !OFFICIAL_ONLY_TYPES.has(template.type))
        .map((template) => ({
            type: template.type,
            name: template.name,
            source: template.companyId ? 'company' as const : 'global' as const,
            hasStoredTemplate: true
        }));

    return { standardTemplates, customTemplates };
};

const normalizeQuantity = (value?: number) => {
    if (!Number.isFinite(value) || Number(value) <= 0) {
        return 1;
    }

    return Math.max(1, Math.floor(Number(value)));
};

const buildStockAssignmentItems = (selectedItems: InventorySelection[]) => {
    return selectedItems.map((item) => ({
        id: item.id,
        name: item.name,
        size: item.size || ''
    }));
};

const buildMaterialDeliveryItems = (selectedItems: InventorySelection[]) => {
    return selectedItems.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: normalizeQuantity(item.quantity),
        detail: item.detail || ''
    }));
};

export const getDocumentGenerationRequest = ({
    docType,
    employeeId,
    authorName,
    selectedItems = [],
    selectedTechItem = null,
    extraData
}: GenerationRequestInput): GenerationRequest => {
    const payload: Record<string, unknown> = { employeeId, authorName };

    if (docType === 'MODEL_145') {
        return {
            endpoint: '/documents/generate-145',
            payload
        };
    }

    if (docType === 'TECH_DEVICE') {
        if (!selectedTechItem) {
            throw new Error('Selecciona un dispositivo del inventario');
        }

        return {
            endpoint: '/documents/generate-tech',
            payload: {
                ...payload,
                deviceName: selectedTechItem.name,
                serialNumber: selectedTechItem.serialNumber || '',
                itemId: selectedTechItem.id
            }
        };
    }

    if (docType === 'UNIFORM') {
        return {
            endpoint: '/documents/generate-uniform',
            payload: {
                ...payload,
                items: buildStockAssignmentItems(selectedItems)
            }
        };
    }

    if (docType === 'EPI') {
        return {
            endpoint: '/documents/generate-epi',
            payload: {
                ...payload,
                items: buildStockAssignmentItems(selectedItems)
            }
        };
    }

    if (docType === 'ENTREGA_MATERIAL') {
        return {
            endpoint: '/documents/generate-material',
            payload: {
                ...payload,
                items: buildMaterialDeliveryItems(selectedItems)
            }
        };
    }

    if (docType === 'CARTA_FORMAL') {
        return buildGenericTemplatePayload(payload, docType, {
            carta: {
                asunto: extraData?.carta?.asunto || '',
                contenido: extraData?.carta?.contenido || ''
            }
        });
    }

    if (docType === 'JUSTIFICANTE_AUSENCIA') {
        return buildGenericTemplatePayload(payload, docType, {
            ausencia: {
                tipo: extraData?.ausencia?.tipo || '',
                fechaInicio: extraData?.ausencia?.fechaInicio || '',
                fechaFin: extraData?.ausencia?.fechaFin || '',
                dias: extraData?.ausencia?.dias || '',
                motivo: extraData?.ausencia?.motivo || ''
            }
        });
    }

    if (docType === 'FIRMA_DIETAS') {
        return buildGenericTemplatePayload(payload, docType, {
            dietas: {
                concepto: extraData?.dietas?.concepto || '',
                importe: extraData?.dietas?.importe || '',
                fecha: extraData?.dietas?.fecha || '',
                kilometros: extraData?.dietas?.kilometros || ''
            }
        });
    }

    return buildGenericTemplatePayload(payload, docType);
};
