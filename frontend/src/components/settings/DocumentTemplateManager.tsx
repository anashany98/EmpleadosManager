import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
    ChevronLeft,
    ChevronRight,
    Copy,
    Image as ImageIcon,
    ZoomIn,
    ZoomOut,
    Grid3X3,
    QrCode,
    Save,
    Square,
    Trash2,
    Type
} from 'lucide-react';
import { api, BASE_URL } from '../../api/client';
import { toast } from 'sonner';

type TemplateCatalogItem = {
    type: string;
    name: string;
    variables: string[];
    content: string;
};

type StoredTemplate = {
    id: string;
    type: string;
    name: string;
    content: string;
    variables: string;
    companyId: string | null;
    isDefault: boolean;
};

type ResolvedTemplate = {
    name: string;
    type: string;
    content: string;
    variables: string[];
    source: 'company' | 'global' | 'builtin';
};

type EmployeeOption = {
    id: string;
    name?: string;
    firstName?: string | null;
    lastName?: string | null;
    dni?: string;
};

type PreviewContext = Record<string, unknown>;

type LayoutElementType = 'text' | 'variable' | 'box' | 'logo' | 'qr';

type LayoutBaseElement = {
    id: string;
    type: LayoutElementType;
    x: number;
    y: number;
    w: number;
    h: number;
    zIndex: number;
    opacity: number;
};

type TextElement = LayoutBaseElement & {
    type: 'text';
    text: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
    color: string;
    align: 'left' | 'center' | 'right' | 'justify';
    lineHeight: number;
};

type VariableElement = LayoutBaseElement & {
    type: 'variable';
    variable: string;
    prefix: string;
    suffix: string;
    fallback: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
    color: string;
    align: 'left' | 'center' | 'right' | 'justify';
    lineHeight: number;
};

type BoxElement = LayoutBaseElement & {
    type: 'box';
    fillColor: string;
    borderColor: string;
    borderWidth: number;
    radius: number;
};

type LogoElement = LayoutBaseElement & {
    type: 'logo';
    source: 'company' | 'default' | 'custom';
    url: string;
    fit: 'contain' | 'cover';
};

type QrElement = LayoutBaseElement & {
    type: 'qr';
    dataSource: 'document' | 'custom' | 'variable';
    value: string;
    color: string;
    backgroundColor: string;
};

type LayoutElement = TextElement | VariableElement | BoxElement | LogoElement | QrElement;

type LayoutTemplate = {
    kind: 'layout-template';
    version: number;
    page: {
        backgroundColor: string;
        showGrid: boolean;
    };
    elements: LayoutElement[];
};

const DEFAULT_BG = '#ffffff';
const DEFAULT_TEXT = '#0f172a';

const extractData = <T,>(response: unknown, fallback: T): T => {
    if (response?.data?.data !== undefined) return response.data.data as T;
    if (response?.data !== undefined) return response.data as T;
    return (response as T) || fallback;
};

const employeeLabel = (employee: EmployeeOption) => {
    const fullName = `${employee.firstName || employee.name || ''} ${employee.lastName || ''}`.trim();
    return employee.dni ? `${fullName} - ${employee.dni}` : fullName;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const snapToGridValue = (value: number, size: number, enabled: boolean) => {
    if (!enabled) return value;
    return Math.round(value / size) * size;
};

const createId = () => `el_${Math.random().toString(36).slice(2, 10)}`;

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const resolvePath = (context: PreviewContext, expression: string): unknown => {
    return expression.split('.').reduce<unknown>((accumulator, segment) => {
        if (!isObject(accumulator)) {
            return undefined;
        }
        return accumulator[segment];
    }, context);
};

const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
        return value.toLocaleString('es-ES', {
            minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
            maximumFractionDigits: 2
        });
    }
    if (value instanceof Date) {
        return value.toLocaleDateString('es-ES');
    }
    return String(value);
};

const renderStringTemplate = (content: string, context: PreviewContext) => {
    return content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, expression) => {
        const value = resolvePath(context, expression);
        return value === undefined ? match : formatValue(value);
    });
};

const serializeDesign = (design: LayoutTemplate) => JSON.stringify(design);

const parseDesign = (rawContent: string, type: string, fallbackName: string): LayoutTemplate => {
    try {
        const parsed = JSON.parse(rawContent);
        if (parsed?.kind === 'layout-template' && Array.isArray(parsed.elements)) {
            return parsed as LayoutTemplate;
        }
    } catch {
        // ignore
    }

    const lines = (rawContent || '').split(/\r?\n/);
    const heading = lines.find((line) => line.trim().startsWith('# '))?.trim().slice(2) || fallbackName;
    const body = lines
        .filter((line) => !line.trim().startsWith('# '))
        .join('\n')
        .trim();

    return {
        kind: 'layout-template',
        version: 1,
        page: {
            backgroundColor: DEFAULT_BG,
            showGrid: true
        },
        elements: [
            { id: createId(), type: 'box', x: 5, y: 4, w: 90, h: 12, zIndex: 0, opacity: 1, fillColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1, radius: 16 },
            { id: createId(), type: 'logo', x: 7, y: 5.2, w: 18, h: 8, zIndex: 1, opacity: 1, source: 'company', url: '', fit: 'contain' },
            { id: createId(), type: 'qr', x: 86, y: 5, w: 8, h: 8, zIndex: 1, opacity: 1, dataSource: 'document', value: '', color: '#0f172a', backgroundColor: '#ffffff' },
            { id: createId(), type: 'text', x: 24, y: 5.8, w: 56, h: 7, zIndex: 2, opacity: 1, text: heading, fontSize: 20, fontWeight: 'bold', color: '#0f172a', align: 'center', lineHeight: 1.2 },
            { id: createId(), type: 'text', x: 9, y: 21, w: 82, h: 50, zIndex: 2, opacity: 1, text: body || 'Añade aqui el contenido principal del documento.', fontSize: 12, fontWeight: 'normal', color: DEFAULT_TEXT, align: 'justify', lineHeight: 1.5 },
            { id: createId(), type: 'box', x: 10, y: 78, w: 30, h: 12, zIndex: 0, opacity: 1, fillColor: '#ffffff', borderColor: '#cbd5e1', borderWidth: 1, radius: 8 },
            { id: createId(), type: 'box', x: 60, y: 78, w: 30, h: 12, zIndex: 0, opacity: 1, fillColor: '#ffffff', borderColor: '#cbd5e1', borderWidth: 1, radius: 8 },
            { id: createId(), type: 'text', x: 10, y: 91, w: 30, h: 4, zIndex: 1, opacity: 1, text: 'Firma empresa', fontSize: 11, fontWeight: 'bold', color: '#475569', align: 'center', lineHeight: 1.2 },
            { id: createId(), type: 'text', x: 60, y: 91, w: 30, h: 4, zIndex: 1, opacity: 1, text: 'Firma trabajador', fontSize: 11, fontWeight: 'bold', color: '#475569', align: 'center', lineHeight: 1.2 }
        ]
    };
};

const getResolvedText = (element: TextElement | VariableElement, context: PreviewContext) => {
    if (element.type === 'text') {
        return renderStringTemplate(element.text, context);
    }
    const value = formatValue(resolvePath(context, element.variable));
    const finalValue = value || element.fallback;
    return `${element.prefix || ''}${finalValue || ''}${element.suffix || ''}`;
};

const collectVariables = (design: LayoutTemplate) => {
    const variables = new Set<string>();
    design.elements.forEach((element) => {
        if (element.type === 'variable' && element.variable) {
            variables.add(element.variable);
        }
        if (element.type === 'qr' && element.dataSource === 'variable' && element.value) {
            variables.add(element.value);
        }
        if (element.type === 'text') {
            const matches = element.text.match(/\{\{\s*([\w.]+)\s*\}\}/g) || [];
            matches.forEach((match) => variables.add(match.replace(/[{}\s]/g, '')));
        }
    });
    return Array.from(variables).sort((left, right) => left.localeCompare(right, 'es'));
};

const getNextZIndex = (elements: LayoutElement[]) => (elements.length ? Math.max(...elements.map((element) => element.zIndex)) + 1 : 1);

const createElement = (type: LayoutElementType, defaultVariable = 'empleado.nombreCompleto', zIndex = 1): LayoutElement => {
    const base = { id: createId(), type, x: 14, y: 20, w: 32, h: 8, zIndex, opacity: 1 } as LayoutBaseElement;
    if (type === 'text') {
        return { ...base, type, text: 'Nuevo texto', fontSize: 14, fontWeight: 'normal', color: DEFAULT_TEXT, align: 'left', lineHeight: 1.4 };
    }
    if (type === 'variable') {
        return { ...base, type, variable: defaultVariable, prefix: '', suffix: '', fallback: '', fontSize: 14, fontWeight: 'bold', color: DEFAULT_TEXT, align: 'left', lineHeight: 1.4 };
    }
    if (type === 'box') {
        return { ...base, type, w: 40, h: 16, fillColor: '#f8fafc', borderColor: '#cbd5e1', borderWidth: 1, radius: 10 };
    }
    if (type === 'logo') {
        return { ...base, type, x: 8, y: 8, w: 18, h: 10, source: 'company', url: '', fit: 'contain' };
    }
    return { ...base, type: 'qr', x: 82, y: 8, w: 10, h: 10, dataSource: 'document', value: '', color: '#0f172a', backgroundColor: '#ffffff' };
};

const getPreviewImage = (element: LogoElement, context: PreviewContext) => {
    const companyLogo = resolvePath(context, 'empresa.logoUrl');
    if (element.source === 'custom' && element.url) {
        return element.url;
    }
    if (element.source === 'company' && typeof companyLogo === 'string' && companyLogo.trim()) {
        if (/^https?:\/\//i.test(companyLogo)) return companyLogo;
        if (companyLogo.startsWith('/')) return `${BASE_URL}${companyLogo}`;
        return `${BASE_URL}/uploads/${companyLogo}`;
    }
    return `${BASE_URL}/assets/logo.png`;
};

const getQrValue = (element: QrElement, context: PreviewContext, type: string, employeeId: string) => {
    if (element.dataSource === 'custom') {
        return element.value || '';
    }
    if (element.dataSource === 'variable') {
        return formatValue(resolvePath(context, element.value || ''));
    }
    return JSON.stringify({ t: type, eid: employeeId, d: new Date().toISOString() });
};

const tools: Array<{ type: LayoutElementType; label: string; icon: typeof Type }> = [
    { type: 'text', label: 'Texto', icon: Type },
    { type: 'variable', label: 'Variable', icon: Type },
    { type: 'box', label: 'Caja', icon: Square },
    { type: 'logo', label: 'Logo', icon: ImageIcon },
    { type: 'qr', label: 'QR', icon: QrCode }
];

export default function DocumentTemplateManager() {
    const [catalog, setCatalog] = useState<TemplateCatalogItem[]>([]);
    const [storedTemplates, setStoredTemplates] = useState<StoredTemplate[]>([]);
    const [employees, setEmployees] = useState<EmployeeOption[]>([]);
    const [selectedType, setSelectedType] = useState('NDA');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [, setSource] = useState<'company' | 'global' | 'builtin'>('builtin');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [design, setDesign] = useState<LayoutTemplate | null>(null);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [previewContext, setPreviewContext] = useState<PreviewContext>({});
    const [qrImages, setQrImages] = useState<Record<string, string>>({});
    const [leftCollapsed, setLeftCollapsed] = useState(false);
    const [rightCollapsed, setRightCollapsed] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [snapToGrid, setSnapToGrid] = useState(true);
    const [gridSize] = useState(5);

    const previewRef = useRef<HTMLDivElement | null>(null);
    const dragStateRef = useRef<{ elementId: string; startX: number; startY: number; originX: number; originY: number } | null>(null);

    const selectedCatalogItem = useMemo(() => catalog.find((item) => item.type === selectedType) || null, [catalog, selectedType]);
    const currentStored = useMemo(() => storedTemplates.find((item) => item.type === selectedType && item.companyId), [selectedType, storedTemplates]);
    const selectedElement = useMemo(() => design?.elements.find((element) => element.id === selectedElementId) || null, [design, selectedElementId]);
    const sortedElements = useMemo(() => (design ? [...design.elements].sort((a, b) => a.zIndex - b.zIndex) : []), [design]);

    const refreshStoredTemplates = async () => {
        const response = await api.get('/document-templates/stored');
        setStoredTemplates(extractData<StoredTemplate[]>(response, []));
    };

    const loadResolvedTemplate = async (type: string) => {
        const response = await api.get(`/document-templates/${type}`);
        const resolved = extractData<ResolvedTemplate>(response, { name: type, type, content: '', variables: [], source: 'builtin' });
        setTemplateName(resolved.name);
        setSource(resolved.source);
        setDesign(parseDesign(resolved.content, type, resolved.name));
        setSelectedElementId(null);
    };

    const loadPreviewContext = async (employeeId: string) => {
        if (!employeeId) {
            setPreviewContext({});
            return;
        }
        try {
            const response = await api.get(`/document-templates/variables?employeeId=${employeeId}`);
            const data = extractData<{ exampleContext?: PreviewContext }>(response, {});
            setPreviewContext(data.exampleContext || {});
        } catch (error) {
            console.error(error);
            toast.error('No se pudo cargar el contexto de vista previa');
        }
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [catalogResponse, storedResponse, employeesResponse] = await Promise.all([
                    api.get('/document-templates/list'),
                    api.get('/document-templates/stored'),
                    api.get('/employees')
                ]);
                const nextCatalog = extractData<TemplateCatalogItem[]>(catalogResponse, []);
                const nextStored = extractData<StoredTemplate[]>(storedResponse, []);
                const employeePayload = extractData<EmployeeOption[]>(employeesResponse, []);
                const nextEmployees = Array.isArray(employeePayload) ? employeePayload : Array.isArray(employeePayload?.data) ? employeePayload.data : [];
                setCatalog(nextCatalog);
                setStoredTemplates(nextStored);
                setEmployees(nextEmployees);
                const initialType = nextCatalog[0]?.type || 'NDA';
                const initialEmployeeId = nextEmployees[0]?.id || '';
                setSelectedType(initialType);
                setSelectedEmployeeId(initialEmployeeId);
                await loadResolvedTemplate(initialType);
                if (initialEmployeeId) {
                    await loadPreviewContext(initialEmployeeId);
                }
        } catch {
            console.error('Template load error');
            toast.error('No se pudieron cargar las plantillas');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        const buildQrImages = async () => {
            if (!design || !selectedEmployeeId) {
                setQrImages({});
                return;
            }
            const entries = await Promise.all(
                design.elements
                    .filter((element): element is QrElement => element.type === 'qr')
                    .map(async (element) => {
                        const value = getQrValue(element, previewContext, selectedType, selectedEmployeeId) || selectedType;
                        const dataUrl = await QRCode.toDataURL(value, {
                            errorCorrectionLevel: 'M',
                            margin: 1,
                            color: { dark: element.color || '#0f172a', light: element.backgroundColor || '#ffffff' }
                        });
                        return [element.id, dataUrl] as const;
                    })
            );
            setQrImages(Object.fromEntries(entries));
        };
        void buildQrImages();
    }, [design, previewContext, selectedEmployeeId, selectedType]);

    const handleTypeChange = async (type: string) => {
        setSelectedType(type);
        try {
            await loadResolvedTemplate(type);
        } catch (error) {
            console.error(error);
            toast.error('No se pudo cargar la plantilla');
        }
    };

    const handleEmployeeChange = async (employeeId: string) => {
        setSelectedEmployeeId(employeeId);
        await loadPreviewContext(employeeId);
    };

    const updateDesign = (updater: (current: LayoutTemplate) => LayoutTemplate) => {
        setDesign((current) => (current ? updater(current) : current));
    };

    const updateElement = (elementId: string, patch: Partial<LayoutElement>) => {
        updateDesign((current) => ({
            ...current,
            elements: current.elements.map((element) => (element.id === elementId ? { ...element, ...patch } : element))
        }));
    };

    const addElement = (type: LayoutElementType, variableOverride?: string) => {
        if (!design) return;
        const next = createElement(type, variableOverride || selectedCatalogItem?.variables?.[0] || 'empleado.nombreCompleto', getNextZIndex(design.elements));
        updateDesign((current) => ({ ...current, elements: [...current.elements, next] }));
        setSelectedElementId(next.id);
    };

    const deleteSelectedElement = () => {
        if (!design || !selectedElementId) return;
        updateDesign((current) => ({ ...current, elements: current.elements.filter((element) => element.id !== selectedElementId) }));
        setSelectedElementId(null);
    };

    const duplicateSelectedElement = () => {
        if (!design || !selectedElement) return;
        const duplicated = { ...selectedElement, id: createId(), x: clamp(selectedElement.x + 2), y: clamp(selectedElement.y + 2), zIndex: getNextZIndex(design.elements) } as LayoutElement;
        updateDesign((current) => ({ ...current, elements: [...current.elements, duplicated] }));
        setSelectedElementId(duplicated.id);
    };

    const moveSelectedLayer = (direction: 'front' | 'back') => {
        if (!selectedElement) return;
        const currentZ = selectedElement.zIndex;
        const delta = direction === 'front' ? 1 : -1;
        updateElement(selectedElement.id, { zIndex: Math.max(0, currentZ + delta) } as Partial<LayoutElement>);
    };

    const handleSave = async () => {
        if (!design) return;
        setSaving(true);
        try {
            await api.post('/document-templates/save', {
                type: selectedType,
                name: templateName,
                content: serializeDesign(design),
                variables: collectVariables(design),
                scope: 'company'
            });
            await refreshStoredTemplates();
            await loadResolvedTemplate(selectedType);
            toast.success('Plantilla guardada');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'No se pudo guardar la plantilla';
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _handleDeleteCurrent = async () => {
        if (!currentStored) return;
        try {
            await api.delete(`/document-templates/${currentStored.id}`);
            await refreshStoredTemplates();
            await loadResolvedTemplate(selectedType);
            toast.success('Plantilla eliminada');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'No se pudo eliminar';
            toast.error(message);
        }
    };

    const handleDuplicateTemplate = async (targetType: string) => {
        if (!design || selectedType === targetType) return;
        setSaving(true);
        try {
            await api.post('/document-templates/save', {
                type: targetType,
                name: templateName,
                content: serializeDesign(design),
                variables: collectVariables(design),
                scope: 'company'
            });
            toast.success(`Plantilla duplicada como ${targetType}`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'No se pudo duplicar';
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    const handleZoom = (delta: number) => {
        setZoom(z => Math.max(0.5, Math.min(2, z + delta)));
    };

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            const drag = dragStateRef.current;
            const bounds = previewRef.current?.getBoundingClientRect();
            if (!drag || !bounds) return;
            const deltaX = ((event.clientX - drag.startX) / bounds.width) * 100;
            const deltaY = ((event.clientY - drag.startY) / bounds.height) * 100;
            const newX = clamp(drag.originX + deltaX);
            const newY = clamp(drag.originY + deltaY);
            updateElement(drag.elementId, { 
                x: snapToGrid ? snapToGridValue(newX, gridSize, snapToGrid) : newX, 
                y: snapToGrid ? snapToGridValue(newY, gridSize, snapToGrid) : newY 
            } as Partial<LayoutElement>);
        };
        const handlePointerUp = () => {
            dragStateRef.current = null;
        };
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [design, snapToGrid, gridSize, updateElement]);

    const startDragging = (element: LayoutElement, event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedElementId(element.id);
        dragStateRef.current = { elementId: element.id, startX: event.clientX, startY: event.clientY, originX: element.x, originY: element.y };
    };

    if (loading || !design) {
        return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Cargando...</div>;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-140px)]">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                <div className="flex items-center gap-4">
                    <div className="flex gap-1">
                        {catalog.map((item) => (
                            <button
                                key={item.type}
                                onClick={() => handleTypeChange(item.type)}
                                className={`px-4 py-2 text-sm font-medium rounded-xl transition ${
                                    selectedType === item.type 
                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' 
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                }`}
                            >
                                {item.type}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedEmployeeId}
                        onChange={(e) => { void handleEmployeeChange(e.target.value); }}
                        className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                    >
                        <option value="">Preview empleado</option>
                        {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>{employeeLabel(emp)}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-4 py-2 text-sm font-bold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 transition-colors"
                    >
                        <Save size={16} />
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                    <div className="flex items-center gap-1 border-l border-slate-300 dark:border-slate-600 pl-3">
                        <button
                            onClick={() => handleZoom(-0.1)}
                            disabled={zoom <= 0.5}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50"
                            title="Zoom out"
                        >
                            <ZoomOut size={16} />
                        </button>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-12 text-center">{Math.round(zoom * 100)}%</span>
                        <button
                            onClick={() => handleZoom(0.1)}
                            disabled={zoom >= 2}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50"
                            title="Zoom in"
                        >
                            <ZoomIn size={16} />
                        </button>
                        <button
                            onClick={() => setSnapToGrid(!snapToGrid)}
                            className={`p-2 rounded-lg border transition ${snapToGrid ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 text-blue-600' : 'border-slate-200 dark:border-slate-600 text-slate-400'}`}
                            title={snapToGrid ? 'Cuadrícula activa' : 'Cuadrícula inactiva'}
                        >
                            <Grid3X3 size={16} />
                        </button>
                    </div>
                    <select
                        className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-2 text-xs"
                        onChange={(e) => { if (e.target.value) handleDuplicateTemplate(e.target.value); }}
                        value=""
                    >
                        <option value="">Duplicar a...</option>
                        {catalog.filter(c => c.type !== selectedType).map(c => (
                            <option key={c.type} value={c.type}>{c.type} - {c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <aside className={`${leftCollapsed ? 'w-12' : 'w-56'} border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 transition-all flex flex-col`}>
                    {leftCollapsed ? (
                        <button onClick={() => setLeftCollapsed(false)} className="flex h-12 items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                            <ChevronRight size={18} />
                        </button>
                    ) : (
                        <div className="flex flex-col p-3">
                            <div className="mb-3 flex items-center justify-between">
                                <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Herramientas</span>
                                <button onClick={() => setLeftCollapsed(true)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                    <ChevronLeft size={16} />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {tools.map((tool) => {
                                    const Icon = tool.icon;
                                    return (
                                        <button
                                            key={tool.type}
                                            onClick={() => addElement(tool.type)}
                                            className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                        >
                                            <Icon size={18} className="text-blue-500" />
                                            {tool.label}
                                        </button>
                                    );
                                })}
                            </div>
                            {selectedCatalogItem?.variables && selectedCatalogItem.variables.length > 0 && (
                                <div className="mt-4">
                                    <div className="mb-2 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Variables</div>
                                    <div className="flex flex-wrap gap-1 max-h-40 overflow-auto">
                                        {selectedCatalogItem.variables.map((v) => (
                                            <button
                                                key={v}
                                                onClick={() => addElement('variable', v)}
                                                className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600"
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </aside>

                <main className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 p-6">
                    <div className="mx-auto max-w-[820px]">
                        <div
                            ref={previewRef}
                            onClick={() => setSelectedElementId(null)}
                            className="relative mx-auto aspect-[595/842] w-full cursor-default rounded-xl bg-white shadow-xl dark:shadow-slate-900/50 transition-transform"
                            style={{ 
                                backgroundColor: design.page.backgroundColor,
                                transform: `scale(${zoom})`,
                                transformOrigin: 'top center'
                            }}
                        >
                            {design.page.showGrid && (
                                <div
                                    className="pointer-events-none absolute inset-0 opacity-15"
                                    style={{ backgroundImage: 'linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                                />
                            )}
                            {sortedElements.map((element) => {
                                const isSelected = selectedElementId === element.id;
                                const commonStyle: React.CSSProperties = {
                                    left: `${element.x}%`,
                                    top: `${element.y}%`,
                                    width: `${element.w}%`,
                                    height: `${element.h}%`,
                                    zIndex: element.zIndex,
                                    opacity: element.opacity
                                };
                                return (
                                    <div
                                        key={element.id}
                                        onPointerDown={(e) => startDragging(element, e)}
                                        onClick={(e) => { e.stopPropagation(); setSelectedElementId(element.id); }}
                                        className={`absolute cursor-move overflow-hidden ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                                        style={commonStyle}
                                    >
                                        {element.type === 'box' && (
                                            <div
                                                className="h-full w-full"
                                                style={{
                                                    backgroundColor: element.fillColor,
                                                    borderColor: element.borderColor,
                                                    borderWidth: `${element.borderWidth}px`,
                                                    borderStyle: 'solid',
                                                    borderRadius: `${element.radius}px`
                                                }}
                                            />
                                        )}
                                        {(element.type === 'text' || element.type === 'variable') && (
                                            <div
                                                className="h-full w-full whitespace-pre-wrap break-words px-1"
                                                style={{
                                                    color: element.color,
                                                    fontSize: `${element.fontSize}px`,
                                                    fontWeight: element.fontWeight === 'bold' ? 700 : 400,
                                                    textAlign: element.align,
                                                    lineHeight: String(element.lineHeight)
                                                }}
                                            >
                                                {getResolvedText(element, previewContext) || (element.type === 'variable' ? '{{sin valor}}' : 'Texto')}
                                            </div>
                                        )}
                                        {element.type === 'logo' && (
                                            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded border border-dashed border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700">
                                                <img src={getPreviewImage(element, previewContext)} alt="Logo" className={`h-full w-full ${element.fit === 'cover' ? 'object-cover' : 'object-contain'}`} />
                                            </div>
                                        )}
                                        {element.type === 'qr' && (
                                            <div className="flex h-full w-full items-center justify-center rounded border border-slate-200 bg-white p-1">
                                                {qrImages[element.id] ? (
                                                    <img src={qrImages[element.id]} alt="QR" className="h-full w-full object-contain" />
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-400">QR</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </main>

                <aside className={`${rightCollapsed ? 'w-12' : 'w-64'} border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 transition-all flex flex-col`}>
                    {rightCollapsed ? (
                        <button onClick={() => setRightCollapsed(false)} className="flex h-12 items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                            <ChevronLeft size={18} />
                        </button>
                    ) : (
                        <div className="flex flex-col p-3 overflow-auto">
                            <div className="mb-3 flex items-center justify-between">
                                <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Propiedades</span>
                                <button onClick={() => setRightCollapsed(true)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                            {!selectedElement ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Color de fondo</label>
                                        <input
                                            type="color"
                                            value={design.page.backgroundColor}
                                            onChange={(e) => updateDesign((c) => ({ ...c, page: { ...c.page, backgroundColor: e.target.value } }))}
                                            className="mt-1 h-10 w-full rounded-xl border border-slate-300 dark:border-slate-600"
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={design.page.showGrid}
                                            onChange={(e) => updateDesign((c) => ({ ...c, page: { ...c.page, showGrid: e.target.checked } }))}
                                            className="rounded"
                                        />
                                        Mostrar cuadricula
                                    </label>
                                    <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-3 text-xs text-slate-500 dark:text-slate-400">
                                        <p className="font-bold text-slate-700 dark:text-slate-300">Consejo:</p>
                                        Selecciona un elemento para editar sus propiedades.
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="rounded-lg bg-blue-50 dark:bg-blue-900/30 px-2 py-1 text-xs font-bold text-blue-700 dark:text-blue-400">
                                        {selectedElement.type}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">X</label>
                                        <input
                                            type="number"
                                            value={selectedElement.x}
                                            onChange={(e) => updateElement(selectedElement.id, { x: clamp(Number(e.target.value)) } as Partial<LayoutElement>)}
                                            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 px-2 py-1 text-sm bg-white dark:bg-slate-700"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Y</label>
                                        <input
                                            type="number"
                                            value={selectedElement.y}
                                            onChange={(e) => updateElement(selectedElement.id, { y: clamp(Number(e.target.value)) } as Partial<LayoutElement>)}
                                            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 px-2 py-1 text-sm bg-white dark:bg-slate-700"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Ancho</label>
                                            <input
                                                type="number"
                                                value={selectedElement.w}
                                                onChange={(e) => updateElement(selectedElement.id, { w: clamp(Number(e.target.value)) } as Partial<LayoutElement>)}
                                                className="mt-1 w-full rounded border border-slate-200 dark:border-slate-600 px-2 py-1 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Alto</label>
                                            <input
                                                type="number"
                                                value={selectedElement.h}
                                                onChange={(e) => updateElement(selectedElement.id, { h: clamp(Number(e.target.value)) } as Partial<LayoutElement>)}
                                                className="mt-1 w-full rounded border border-slate-200 dark:border-slate-600 px-2 py-1 text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Opacidad</label>
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="1"
                                            step="0.05"
                                            value={selectedElement.opacity}
                                            onChange={(e) => updateElement(selectedElement.id, { opacity: Number(e.target.value) } as Partial<LayoutElement>)}
                                            className="mt-1 w-full"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => moveSelectedLayer('front')} className="flex-1 rounded border border-slate-200 dark:border-slate-600 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-600">
                                            Delante
                                        </button>
                                        <button onClick={() => moveSelectedLayer('back')} className="flex-1 rounded border border-slate-200 dark:border-slate-600 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-600">
                                            Detras
                                        </button>
                                    </div>
                                    {(selectedElement.type === 'text' || selectedElement.type === 'variable') && (
                                        <div className="space-y-3 border-t border-gray-200 pt-3">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                                                    {selectedElement.type === 'text' ? 'Texto' : 'Variable'}
                                                </label>
                                                {selectedElement.type === 'text' ? (
                                                    <textarea
                                                        value={selectedElement.text}
                                                        onChange={(e) => updateElement(selectedElement.id, { text: e.target.value } as Partial<LayoutElement>)}
                                                        rows={4}
                                                        className="mt-1 w-full rounded border border-slate-200 dark:border-slate-600 px-2 py-1 text-sm"
                                                    />
                                                ) : (
                                                    <select
                                                        value={selectedElement.variable}
                                                        onChange={(e) => updateElement(selectedElement.id, { variable: e.target.value } as Partial<LayoutElement>)}
                                                        className="mt-1 w-full rounded border border-slate-200 dark:border-slate-600 px-2 py-1 text-sm"
                                                    >
                                                        {(selectedCatalogItem?.variables || []).map((v) => (
                                                            <option key={v} value={v}>{v}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <input
                                                    value={selectedElement.prefix}
                                                    onChange={(e) => updateElement(selectedElement.id, { prefix: e.target.value } as Partial<LayoutElement>)}
                                                    placeholder="Prefijo"
                                                    className="rounded border border-slate-200 dark:border-slate-600 px-2 py-1 text-xs"
                                                />
                                                <input
                                                    value={selectedElement.suffix}
                                                    onChange={(e) => updateElement(selectedElement.id, { suffix: e.target.value } as Partial<LayoutElement>)}
                                                    placeholder="Suffijo"
                                                    className="rounded border border-slate-200 dark:border-slate-600 px-2 py-1 text-xs"
                                                />
                                                <input
                                                    value={selectedElement.fallback}
                                                    onChange={(e) => updateElement(selectedElement.id, { fallback: e.target.value } as Partial<LayoutElement>)}
                                                    placeholder="Default"
                                                    className="rounded border border-slate-200 dark:border-slate-600 px-2 py-1 text-xs"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Tamano</label>
                                                    <input
                                                        type="number"
                                                        value={selectedElement.fontSize}
                                                        onChange={(e) => updateElement(selectedElement.id, { fontSize: Number(e.target.value) } as Partial<LayoutElement>)}
                                                        className="mt-1 w-full rounded border border-slate-200 dark:border-slate-600 px-2 py-1 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Alineacion</label>
                                                    <select
                                                        value={selectedElement.align}
                                                        onChange={(e) => updateElement(selectedElement.id, { align: e.target.value as TextElement['align'] } as Partial<LayoutElement>)}
                                                        className="mt-1 w-full rounded border border-slate-200 dark:border-slate-600 px-2 py-1 text-sm"
                                                    >
                                                        <option value="left">Izq</option>
                                                        <option value="center">Centro</option>
                                                        <option value="right">Der</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Color</label>
                                                <input
                                                    type="color"
                                                    value={selectedElement.color}
                                                    onChange={(e) => updateElement(selectedElement.id, { color: e.target.value } as Partial<LayoutElement>)}
                                                    className="mt-1 h-8 w-full rounded border border-slate-200 dark:border-slate-600"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {selectedElement.type === 'box' && (
                                        <div className="space-y-3 border-t border-gray-200 pt-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Relleno</label>
                                                    <input
                                                        type="color"
                                                        value={selectedElement.fillColor}
                                                        onChange={(e) => updateElement(selectedElement.id, { fillColor: e.target.value } as Partial<LayoutElement>)}
                                                        className="mt-1 h-8 w-full rounded border border-slate-200 dark:border-slate-600"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Borde</label>
                                                    <input
                                                        type="color"
                                                        value={selectedElement.borderColor}
                                                        onChange={(e) => updateElement(selectedElement.id, { borderColor: e.target.value } as Partial<LayoutElement>)}
                                                        className="mt-1 h-8 w-full rounded border border-slate-200 dark:border-slate-600"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Grosor</label>
                                                    <input
                                                        type="number"
                                                        value={selectedElement.borderWidth}
                                                        onChange={(e) => updateElement(selectedElement.id, { borderWidth: Number(e.target.value) } as Partial<LayoutElement>)}
                                                        className="mt-1 w-full rounded border border-slate-200 dark:border-slate-600 px-2 py-1 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Radio</label>
                                                    <input
                                                        type="number"
                                                        value={selectedElement.radius}
                                                        onChange={(e) => updateElement(selectedElement.id, { radius: Number(e.target.value) } as Partial<LayoutElement>)}
                                                        className="mt-1 w-full rounded border border-slate-200 dark:border-slate-600 px-2 py-1 text-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {selectedElement.type === 'logo' && (
                                        <div className="space-y-3 border-t border-slate-200 dark:border-slate-600 pt-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Fuente</label>
                                                <select
                                                    value={selectedElement.source}
                                                    onChange={(e) => updateElement(selectedElement.id, { source: e.target.value as LogoElement['source'] } as Partial<LayoutElement>)}
                                                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 px-2 py-1 text-sm bg-white dark:bg-slate-700"
                                                >
                                                    <option value="company">Empresa</option>
                                                    <option value="default">Default</option>
                                                    <option value="upload">Subir logo</option>
                                                    <option value="custom">URL</option>
                                                </select>
                                            </div>
                                            {selectedElement.source === 'custom' && (
                                                <input
                                                    value={selectedElement.url}
                                                    onChange={(e) => updateElement(selectedElement.id, { url: e.target.value } as Partial<LayoutElement>)}
                                                    placeholder="https://..."
                                                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs bg-white dark:bg-slate-700"
                                                />
                                            )}
                                            {selectedElement.source === 'upload' && (
                                                <div>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={async (e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;
                                                            try {
                                                                const formData = new FormData();
                                                                formData.append('logo', file);
                                                                const response = await api.post('/document-templates/logo', formData, {
                                                                    headers: { 'Content-Type': 'multipart/form-data' }
                                                                });
                                                                const data = response?.data?.data || response?.data;
                                                                if (data?.logoUrl) {
                                                                    updateElement(selectedElement.id, { url: data.logoUrl, source: 'custom' } as Partial<LayoutElement>);
                                                                    toast.success('Logo subido correctamente');
                                                                }
                                                             } catch {
                                                                toast.error(err.message || 'Error al subir logo');
                                                            }
                                                        }}
                                                        className="mt-1 w-full text-xs text-slate-500 dark:text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-blue-500 file:text-white file:font-medium"
                                                    />
                                                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Sube una imagen (jpg, png, svg, webp)</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {selectedElement.type === 'qr' && (
                                        <div className="space-y-3 border-t border-slate-200 dark:border-slate-600 pt-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Origen</label>
                                                <select
                                                    value={selectedElement.dataSource}
                                                    onChange={(e) => updateElement(selectedElement.id, { dataSource: e.target.value as QrElement['dataSource'] } as Partial<LayoutElement>)}
                                                    className="mt-1 w-full rounded border border-slate-200 dark:border-slate-600 px-2 py-1 text-sm"
                                                >
                                                    <option value="document">Documento</option>
                                                    <option value="variable">Variable</option>
                                                    <option value="custom">Custom</option>
                                                </select>
                                            </div>
                                            {selectedElement.dataSource === 'custom' && (
                                                <textarea
                                                    value={selectedElement.value}
                                                    onChange={(e) => updateElement(selectedElement.id, { value: e.target.value } as Partial<LayoutElement>)}
                                                    rows={2}
                                                    className="w-full rounded border border-slate-200 dark:border-slate-600 px-2 py-1 text-xs"
                                                />
                                            )}
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Color</label>
                                                    <input
                                                        type="color"
                                                        value={selectedElement.color}
                                                        onChange={(e) => updateElement(selectedElement.id, { color: e.target.value } as Partial<LayoutElement>)}
                                                        className="mt-1 h-8 w-full rounded border border-slate-200 dark:border-slate-600"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Fondo</label>
                                                    <input
                                                        type="color"
                                                        value={selectedElement.backgroundColor}
                                                        onChange={(e) => updateElement(selectedElement.id, { backgroundColor: e.target.value } as Partial<LayoutElement>)}
                                                        className="mt-1 h-8 w-full rounded border border-slate-200 dark:border-slate-600"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex gap-2 border-t border-gray-200 pt-3">
                                        <button
                                            onClick={duplicateSelectedElement}
                                            className="flex flex-1 items-center justify-center gap-1 rounded border border-slate-200 dark:border-slate-600 bg-white px-2 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-600"
                                        >
                                            <Copy size={14} />
                                            Dup
                                        </button>
                                        <button
                                            onClick={deleteSelectedElement}
                                            className="flex flex-1 items-center justify-center gap-1 rounded border border-red-300 bg-red-50 px-2 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
                                        >
                                            <Trash2 size={14} />
                                            Borra
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}