import { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    Check,
    ExternalLink,
    FileText,
    Loader2,
    Lock,
    MapPin,
    Scale,
    Search,
    ShieldCheck,
    Shirt,
    Smartphone,
    Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { API_URL, api, getErrorMessage } from '../api/client';
import {
    extractApiArray,
    getDocumentGenerationRequest,
    resolveDocumentGeneratorTemplates,
    type DocumentGeneratorExtraData,
    type InventorySelection,
    type TemplateCardOption
} from './documentGeneratorUtils';

interface DocumentGeneratorProps {
    employeeId: string;
    onDocumentGenerated?: () => void;
}

interface EmployeeResponse {
    company?: {
        legalRep?: string;
    };
}

interface InventoryItem {
    id: string;
    name: string;
    quantity?: number;
    size?: string;
    unit?: string;
    category?: string;
    serialNumber?: string;
}

interface TemplateCardMeta {
    icon: typeof FileText;
    section: 'entrega' | 'legal' | 'rrhh';
}

interface GeneratedDocument {
    documentId?: string;
    fileName?: string;
    fileUrl?: string;
}

const TEMPLATE_CARD_META: Record<string, TemplateCardMeta> = {
    UNIFORM: { icon: Shirt, section: 'entrega' },
    EPI: { icon: ShieldCheck, section: 'entrega' },
    TECH_DEVICE: { icon: Smartphone, section: 'entrega' },
    ENTREGA_MATERIAL: { icon: FileText, section: 'entrega' },
    MODEL_145: { icon: FileText, section: 'legal' },
    NDA: { icon: Lock, section: 'legal' },
    RGPD: { icon: Scale, section: 'legal' },
    CERTIFICADO_EMPRESA: { icon: FileText, section: 'rrhh' },
    CERTIFICADO_TRABAJO: { icon: FileText, section: 'rrhh' },
    CARTA_FORMAL: { icon: FileText, section: 'rrhh' },
    JUSTIFICANTE_AUSENCIA: { icon: FileText, section: 'rrhh' },
    OBRA_EXPENSE_RECEIPT: { icon: FileText, section: 'rrhh' }
};

const SECTION_TITLES = {
    entrega: 'Entrega y activos',
    legal: 'Legal y oficial',
    rrhh: 'Documentos RRHH'
} as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const extractApiItem = <T,>(response: unknown): T | null => {
    const data = isObject(response) ? response.data : undefined;
    if (isObject(data)) return data as T;
    return isObject(response) ? response as T : null;
};

const isMaterialDocument = (docType: string) => ['UNIFORM', 'EPI', 'ENTREGA_MATERIAL'].includes(docType);

const normalizeCategory = (value?: string) => (value || '').trim().toUpperCase();

const filterInventoryByDocType = (items: InventoryItem[], docType: string, itemSearch: string) => {
    const normalizedSearch = itemSearch.trim().toLowerCase();

    return items
        .filter((item) => {
            const category = normalizeCategory(item.category);

            if (docType === 'UNIFORM') {
                return ['UNIFORM', 'UNIFORME', 'ROPA', 'CLOTHING'].includes(category);
            }

            if (docType === 'EPI') {
                return ['EPI', 'EPIS', 'PRL', 'PROTECCION', 'SAFETY'].includes(category);
            }

            if (docType === 'TECH_DEVICE') {
                return ['TECH', 'TECHNOLOGY', 'TECNOLOGIA', 'TECH_DEVICE', 'ELECTRONICA', 'OTHER', 'OTROS'].includes(category);
            }

            return true;
        })
        .filter((item) => item.name.toLowerCase().includes(normalizedSearch));
};

const calculateAbsenceDays = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return '';

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        return '';
    }

    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
};

const statusTextBySource = (template: TemplateCardOption) => {
    if (template.source === 'official') return 'Oficial AEAT';
    if (template.source === 'company') return 'Plantilla empresa';
    if (template.source === 'global') return 'Plantilla global';
    return '';
};

const createEmptyGeneratorCatalog = () => resolveDocumentGeneratorTemplates([], []);

export default function DocumentGenerator({ employeeId, onDocumentGenerated }: DocumentGeneratorProps) {
    const [loading, setLoading] = useState(false);
    const [docType, setDocType] = useState('UNIFORM');
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [selectedItems, setSelectedItems] = useState<InventorySelection[]>([]);
    const [authorName, setAuthorName] = useState('');
    const [standardTemplates, setStandardTemplates] = useState<TemplateCardOption[]>(createEmptyGeneratorCatalog().standardTemplates);
    const [customTemplates, setCustomTemplates] = useState<TemplateCardOption[]>([]);
    const [selectedTechItem, setSelectedTechItem] = useState<InventorySelection | null>(null);
    const [itemSearch, setItemSearch] = useState('');
    const [letterData, setLetterData] = useState({ asunto: '', contenido: '' });
    const [absenceData, setAbsenceData] = useState({ tipo: '', fechaInicio: '', fechaFin: '', dias: '', motivo: '' });
    const [generatedDocument, setGeneratedDocument] = useState<GeneratedDocument | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [inventoryResponse, employeeResponse, catalogResponse, storedResponse] = await Promise.all([
                    api.get<unknown>('/inventory'),
                    api.get<unknown>(`/employees/${employeeId}`),
                    api.get<unknown>('/document-templates/list'),
                    api.get<unknown>(`/document-templates/stored?employeeId=${encodeURIComponent(employeeId)}`)
                ]);

                setInventoryItems(extractApiArray<InventoryItem>(inventoryResponse));

                const employee = extractApiItem<EmployeeResponse>(employeeResponse);
                if (employee?.company?.legalRep) {
                    setAuthorName(employee.company.legalRep);
                }

                const resolvedTemplates = resolveDocumentGeneratorTemplates(catalogResponse, storedResponse);
                setStandardTemplates(resolvedTemplates.standardTemplates);
                setCustomTemplates(resolvedTemplates.customTemplates);
                setDocType((current) => {
                    const availableTypes = new Set([
                        ...resolvedTemplates.standardTemplates.map((template) => template.type),
                        ...resolvedTemplates.customTemplates.map((template) => template.type)
                    ]);
                    return availableTypes.has(current) ? current : (resolvedTemplates.standardTemplates[0]?.type || 'UNIFORM');
                });
            } catch (error) {
                console.error('Error loading document generator data', error);
            }
        };

        void load();
    }, [employeeId]);

    const groupedStandardTemplates = useMemo(() => {
        return (Object.keys(SECTION_TITLES) as Array<keyof typeof SECTION_TITLES>).map((sectionKey) => ({
            id: sectionKey,
            title: SECTION_TITLES[sectionKey],
            templates: standardTemplates.filter((template) => TEMPLATE_CARD_META[template.type]?.section === sectionKey)
        })).filter((section) => section.templates.length > 0);
    }, [standardTemplates]);

    const filteredInventoryItems = useMemo(
        () => filterInventoryByDocType(inventoryItems, docType, itemSearch),
        [inventoryItems, docType, itemSearch]
    );

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const extraData: DocumentGeneratorExtraData = {
                carta: letterData,
                ausencia: absenceData
            };

            const { endpoint, payload } = getDocumentGenerationRequest({
                docType,
                employeeId,
                authorName,
                selectedItems,
                selectedTechItem,
                extraData
            });

            const response = await api.post<unknown>(endpoint, payload);
            const generated = extractApiItem<GeneratedDocument>(response);
            setGeneratedDocument(generated);
            toast.success('Documento creado y guardado en el expediente');
            onDocumentGenerated?.();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'No se pudo generar el documento'));
        } finally {
            setLoading(false);
        }
    };

    const toggleItem = (item: InventoryItem) => {
        if (selectedItems.find((selectedItem) => selectedItem.id === item.id)) {
            setSelectedItems((current) => current.filter((selectedItem) => selectedItem.id !== item.id));
            return;
        }

        setSelectedItems((current) => [
            ...current,
            {
                id: item.id,
                name: item.name,
                size: '',
                quantity: 1,
                detail: '',
                serialNumber: item.serialNumber
            }
        ]);
    };

    const updateItemSize = (id: string, size: string) => {
        setSelectedItems((current) => current.map((item) => item.id === id ? { ...item, size } : item));
    };

    const handleAbsenceDateChange = (field: 'fechaInicio' | 'fechaFin', value: string) => {
        setAbsenceData((current) => {
            const next = { ...current, [field]: value };
            const calculatedDays = calculateAbsenceDays(next.fechaInicio, next.fechaFin);
            return {
                ...next,
                dias: calculatedDays === '' ? current.dias : String(calculatedDays)
            };
        });
    };

    const updateItemQuantity = (id: string, quantity: string) => {
        const parsedQuantity = Number.parseInt(quantity, 10);
        setSelectedItems((current) => current.map((item) => item.id === id ? {
            ...item,
            quantity: Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1
        } : item));
    };

    const updateItemDetail = (id: string, detail: string) => {
        setSelectedItems((current) => current.map((item) => item.id === id ? { ...item, detail } : item));
    };

    const renderTemplateCard = (template: TemplateCardOption) => {
        const Icon = TEMPLATE_CARD_META[template.type]?.icon || FileText;
        const isSelected = docType === template.type;
        const statusText = statusTextBySource(template);

        return (
            <button
                key={template.type}
                onClick={() => setDocType(template.type)}
                className={`flex min-h-[112px] flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors ${
                    isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100 dark:bg-blue-950/20 dark:text-blue-400'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                }`}
            >
                <div className={`rounded-lg p-2 transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <Icon size={20} />
                </div>
                <span className="line-clamp-2 text-sm font-semibold leading-4">
                    {template.name}
                </span>
                {statusText && (
                    <span className="text-[10px] font-medium text-slate-400">
                        {statusText}
                    </span>
                )}
            </button>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {groupedStandardTemplates.map((section) => (
                <div key={section.id} className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{section.title}</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {section.templates.map(renderTemplateCard)}
                    </div>
                </div>
            ))}

            {customTemplates.length > 0 && (
                <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plantillas personalizadas</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {customTemplates.map(renderTemplateCard)}
                    </div>
                </div>
            )}

            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32" />

                <div className="relative z-10 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Autoriza el documento</label>
                            <input
                                value={authorName}
                                onChange={(event) => setAuthorName(event.target.value)}
                                className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                                placeholder="Nombre del Responsable"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ubicación de firma</label>
                            <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-200/50 dark:bg-slate-800/50 text-slate-500">
                                <MapPin size={16} />
                                <span className="text-sm font-bold">Auto-detectado por Empresa</span>
                            </div>
                        </div>
                    </div>

                    {isMaterialDocument(docType) && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seleccionar material a entregar</label>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Buscar en inventario..."
                                        className="w-full pl-12 pr-5 py-4 rounded-3xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                                        value={itemSearch}
                                        onChange={(event) => setItemSearch(event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-1 accent-blue-600">
                                {filteredInventoryItems.length === 0 && inventoryItems.length === 0 && (
                                    <div className="col-span-full py-8 text-center text-slate-400 text-sm">
                                        <p>No hay artículos en el inventario</p>
                                        <p className="text-xs mt-1">Agrega artículos desde la sección de Inventario</p>
                                    </div>
                                )}

                                {filteredInventoryItems.length === 0 && inventoryItems.length > 0 && (
                                    <div className="col-span-full py-8 text-center text-slate-400 text-sm">
                                        <p>No se encontraron artículos para este documento</p>
                                    </div>
                                )}

                                {filteredInventoryItems.map((item) => {
                                    const isSelected = Boolean(selectedItems.find((selectedItem) => selectedItem.id === item.id));

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => toggleItem(item)}
                                            className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between group ${
                                                isSelected
                                                    ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-500'
                                                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'
                                            }`}
                                        >
                                            <div>
                                                <p className={`font-bold text-sm ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                                    {item.name}
                                                </p>
                                                <p className="text-[10px] text-slate-400">Stock: {item.quantity ?? 0}{item.size ? ` | Talla: ${item.size}` : ''} {item.unit || ''}</p>
                                            </div>
                                            {isSelected && <Check size={16} className="text-blue-500" />}
                                        </button>
                                    );
                                })}
                            </div>

                            {selectedItems.length > 0 && (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {docType === 'ENTREGA_MATERIAL' ? 'Configurar detalles' : 'Configurar tallas / notas'}
                                    </label>
                                    {selectedItems.map((item) => (
                                        <div key={item.id} className="flex flex-col gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 md:flex-row md:items-center">
                                            <span className="flex-1 font-bold text-sm">{item.name}</span>
                                            {docType === 'ENTREGA_MATERIAL' ? (
                                                <>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        className="w-24 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border-none text-xs font-bold"
                                                        value={item.quantity || 1}
                                                        onChange={(event) => updateItemQuantity(item.id || '', event.target.value)}
                                                    />
                                                    <input
                                                        placeholder="Detalle (opcional)"
                                                        className="w-full md:w-52 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border-none text-xs font-bold"
                                                        value={item.detail || ''}
                                                        onChange={(event) => updateItemDetail(item.id || '', event.target.value)}
                                                    />
                                                </>
                                            ) : (
                                                <input
                                                    placeholder="Talla / nota"
                                                    className="w-full md:w-40 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border-none text-xs font-bold"
                                                    value={item.size || ''}
                                                    onChange={(event) => updateItemSize(item.id || '', event.target.value)}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {docType === 'TECH_DEVICE' && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seleccionar dispositivo del inventario</label>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Buscar en inventario..."
                                        className="w-full pl-12 pr-5 py-4 rounded-3xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                                        value={itemSearch}
                                        onChange={(event) => setItemSearch(event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-1 accent-blue-600">
                                {filteredInventoryItems.length === 0 && inventoryItems.length === 0 && (
                                    <div className="col-span-full py-8 text-center text-slate-400 text-sm">
                                        <p>No hay artículos en el inventario</p>
                                        <p className="text-xs mt-1">Agrega artículos desde la sección de Inventario</p>
                                    </div>
                                )}

                                {filteredInventoryItems.length === 0 && inventoryItems.length > 0 && (
                                    <div className="col-span-full py-8 text-center text-slate-400 text-sm">
                                        <p>No hay dispositivos tecnológicos disponibles</p>
                                    </div>
                                )}

                                {filteredInventoryItems.map((item) => {
                                    const isSelected = selectedTechItem?.id === item.id;

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setSelectedTechItem(isSelected ? null : {
                                                id: item.id,
                                                name: item.name,
                                                serialNumber: item.serialNumber
                                            })}
                                            className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between group ${
                                                isSelected
                                                    ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-500'
                                                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'
                                            }`}
                                        >
                                            <div>
                                                <p className={`font-bold text-sm ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                                    {item.name}
                                                </p>
                                                <p className="text-[10px] text-slate-400">Stock: {item.quantity ?? 0}{item.size ? ` | Talla: ${item.size}` : ''} {item.unit || ''}</p>
                                            </div>
                                            {isSelected && <Check size={16} className="text-blue-500" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {docType === 'CARTA_FORMAL' && (
                        <div className="grid grid-cols-1 gap-6 animate-in slide-in-from-bottom-2 duration-300">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Asunto</label>
                                <input
                                    value={letterData.asunto}
                                    onChange={(event) => setLetterData((current) => ({ ...current, asunto: event.target.value }))}
                                    className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                                    placeholder="Asunto de la carta"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contenido</label>
                                <textarea
                                    value={letterData.contenido}
                                    onChange={(event) => setLetterData((current) => ({ ...current, contenido: event.target.value }))}
                                    className="w-full min-h-[180px] px-5 py-4 rounded-[2rem] bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-sm font-medium resize-y"
                                    placeholder="Contenido principal de la carta"
                                />
                            </div>
                        </div>
                    )}

                    {docType === 'JUSTIFICANTE_AUSENCIA' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-2 duration-300">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo de ausencia</label>
                                <input
                                    value={absenceData.tipo}
                                    onChange={(event) => setAbsenceData((current) => ({ ...current, tipo: event.target.value }))}
                                    className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                                    placeholder="Vacaciones, consulta, permiso..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Días</label>
                                <input
                                    value={absenceData.dias}
                                    onChange={(event) => setAbsenceData((current) => ({ ...current, dias: event.target.value }))}
                                    className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                                    placeholder="Número de días"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha inicio</label>
                                <input
                                    type="date"
                                    value={absenceData.fechaInicio}
                                    onChange={(event) => handleAbsenceDateChange('fechaInicio', event.target.value)}
                                    className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha fin</label>
                                <input
                                    type="date"
                                    value={absenceData.fechaFin}
                                    onChange={(event) => handleAbsenceDateChange('fechaFin', event.target.value)}
                                    className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                                />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Motivo</label>
                                <textarea
                                    value={absenceData.motivo}
                                    onChange={(event) => setAbsenceData((current) => ({ ...current, motivo: event.target.value }))}
                                    className="w-full min-h-[140px] px-5 py-4 rounded-[2rem] bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-sm font-medium resize-y"
                                    placeholder="Detalle del motivo de la ausencia"
                                />
                            </div>
                        </div>
                    )}

                    {docType === 'OBRA_EXPENSE_RECEIPT' && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-blue-950">
                            <p className="font-semibold">Los recibís de dietas se generan desde la pestaña Dietas.</p>
                            <p className="mt-1 text-sm text-blue-800">
                                Esta es la misma plantilla que se aplica allí a los gastos contabilizados, sus fechas, importes, obra y empleado.
                            </p>
                        </div>
                    )}

                    {['MODEL_145', 'NDA', 'RGPD'].includes(docType) && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 flex items-center gap-4 animate-in slide-in-from-bottom-2 duration-300">
                            <div className={`p-3 rounded-2xl text-white ${
                                docType === 'NDA'
                                    ? 'bg-red-500'
                                    : docType === 'RGPD'
                                        ? 'bg-indigo-500'
                                        : 'bg-emerald-500'
                            }`}>
                                {docType === 'NDA'
                                    ? <Lock size={24} />
                                    : docType === 'RGPD'
                                        ? <Scale size={24} />
                                        : <AlertCircle size={24} />}
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white text-sm">
                                    {docType === 'NDA'
                                        ? 'Acuerdo de confidencialidad'
                                        : docType === 'RGPD'
                                            ? 'Protección de datos (RGPD)'
                                            : 'Modelo 145 oficial'}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {docType === 'NDA'
                                        ? 'Se generará usando la plantilla activa de confidencialidad.'
                                        : docType === 'RGPD'
                                            ? 'Se generará usando la plantilla activa de protección de datos.'
                                            : 'Se genera siempre sobre el formulario oficial del Estado / AEAT.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {generatedDocument && (
                        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-semibold text-emerald-900">Documento guardado en el expediente</p>
                                <p className="text-xs text-emerald-700">{generatedDocument.fileName || 'Documento generado'}</p>
                            </div>
                            {generatedDocument.fileUrl && (
                                <a
                                    href={`${API_URL}${generatedDocument.fileUrl}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                                >
                                    <ExternalLink size={15} /> Abrir documento
                                </a>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end border-t border-slate-100 pt-6 dark:border-slate-800">
                        <button
                            onClick={handleGenerate}
                            disabled={loading || docType === 'OBRA_EXPENSE_RECEIPT' || (docType === 'TECH_DEVICE' && !selectedTechItem)}
                            className="group flex min-h-11 items-center gap-3 rounded-lg bg-slate-900 px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Sparkles className="group-hover:animate-pulse" />}
                            {loading ? 'Generando...' : 'Generar documento'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
