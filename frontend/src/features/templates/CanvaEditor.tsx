import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FilePlus, Users, X, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { UnsavedChangesBanner } from '../../components/feedback/UnsavedChangesBanner';
import {
    AVAILABLE_VARIABLES as BASE_AVAILABLE_VARIABLES,
    DEFAULT_TEMPLATES as BASE_DEFAULT_TEMPLATES,
    createElementsForTemplate,
    mergeTemplatesWithDefaults,
    serializeTemplateContent
} from './templateBases';
import type { Template } from './templateBases';
import { extractTemplateVariables } from './templateVariables';
import { CanvasStage } from './components/CanvasStage';
import { ElementToolbar } from './components/ElementToolbar';
import { LayersPanel } from './components/LayersPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { TopBar } from './components/TopBar';
import { PreviewPane } from './components/PreviewPane';
import { DuplicateTemplateDialog } from './components/DuplicateTemplateDialog';
import { VariableInspector } from './components/VariableInspector';
import type { CanvasElement, ElementType } from './components/types';

interface Employee {
    id: string;
    dni: string;
    nombreCompleto: string;
    puesto: string;
    fechaAlta: string;
    tipoContrato?: string;
}

const extractList = <T,>(response: unknown): T[] => {
    if (Array.isArray(response)) return response as T[];
    const data = (response as { data?: unknown } | null)?.data;
    if (Array.isArray(data)) return data as T[];
    const nested = (data as { data?: unknown } | null)?.data;
    return Array.isArray(nested) ? nested as T[] : [];
};

const extractItem = <T,>(response: unknown): T | null => {
    const data = (response as { data?: unknown } | null)?.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as T;
    return response && typeof response === 'object' && !Array.isArray(response) ? (response as T) : null;
};

export default function CanvaEditor() {
    const [elements, setElements] = useState<CanvasElement[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<Template>(BASE_DEFAULT_TEMPLATES[0]);
    const [zoom, setZoom] = useState(100);
    const [showGrid, setShowGrid] = useState(true);
    const [saving, setSaving] = useState(false);
    const [variableContext, setVariableContext] = useState<Record<string, unknown>>({});
    const [templates, setTemplates] = useState<Template[]>(BASE_DEFAULT_TEMPLATES);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [previewEmployeeId, setPreviewEmployeeId] = useState<string>('');
    const [catalogSource, setCatalogSource] = useState<'backend' | 'fallback'>('fallback');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { isDirty, markDirty, markClean, confirmDiscard } = useUnsavedChanges();

    // ---------------------------------------------------------------------------
    // Data loading
    // ---------------------------------------------------------------------------

    useEffect(() => {
        const fetchTemplates = async () => {
            setLoadingTemplates(true);
            try {
                const [catalogResponse, storedResponse] = await Promise.all([
                    api.get<unknown>('/document-templates/list'),
                    api.get<unknown>('/document-templates/stored')
                ]);
                const remoteTemplates = [
                    ...extractList<Template>(catalogResponse),
                    ...extractList<Template>(storedResponse)
                ];
                const merged = mergeTemplatesWithDefaults(remoteTemplates);
                if (merged.length > 0) {
                    setTemplates(merged);
                    setSelectedTemplate((current) => merged.find((t) => t.type === current.type) || merged[0]);
                    setCatalogSource('backend');
                }
            } catch (error) {
                console.warn('Usando plantillas locales:', error);
                toast.warning('No se pudo conectar con el servidor de plantillas. Mostrando catálogo local.');
                setCatalogSource('fallback');
            } finally {
                setLoadingTemplates(false);
            }
        };
        void fetchTemplates();
    }, []);

    useEffect(() => {
        if (!selectedTemplate) return;
        setElements(createElementsForTemplate(selectedTemplate));
        setSelectedId(null);
        // Only clear dirty state when the user explicitly switches to a different
        // template. The bootstrap fetch replaces `selectedTemplate` with an
        // equivalent object after mount, which must NOT wipe the user's changes.
    }, [selectedTemplate?.id, selectedTemplate?.type]);

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const response = await api.get<unknown>('/employees');
                setEmployees(extractList<Employee>(response));
            } catch (error) {
                console.warn('Error al cargar empleados:', error);
            }
        };
        void fetchEmployees();
    }, []);

    useEffect(() => {
        if (!previewEmployeeId) {
            setVariableContext({});
            return;
        }
        const fetchContext = async () => {
            try {
                const response = await api.get<{ data?: { exampleContext?: Record<string, unknown> } } | Record<string, unknown>>(
                    `/document-templates/variables?employeeId=${previewEmployeeId}`
                );
                const data = extractItem<{ exampleContext?: Record<string, unknown> }>(response);
                if (data?.exampleContext) {
                    setVariableContext(data.exampleContext);
                }
            } catch (error) {
                console.warn('No se pudo cargar el contexto de variables:', error);
            }
        };
        void fetchContext();
    }, [previewEmployeeId]);

    // ---------------------------------------------------------------------------
    // Mutations
    // ---------------------------------------------------------------------------

    const handleCreateNewTemplate = useCallback(() => {
        if (!newTemplateName.trim()) {
            toast.error('El nombre de la plantilla es obligatorio');
            return;
        }
        const newTemplate: Template = {
            id: `custom_${Date.now()}`,
            name: newTemplateName.trim(),
            type: 'CUSTOM'
        };
        setTemplates((prev) => [...prev, newTemplate]);
        setSelectedTemplate(newTemplate);
        setElements([]);
        setShowNewTemplateModal(false);
        setNewTemplateName('');
        toast.success(`Plantilla «${newTemplateName}» creada`);
    }, [newTemplateName]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            const variables = extractTemplateVariables(serializeTemplateContent(elements));
            const payload = {
                type: selectedTemplate.type,
                name: selectedTemplate.name,
                content: serializeTemplateContent(elements),
                variables
            };
            const response = await api.post<unknown>('/document-templates/save', payload);
            const savedTemplate = extractItem<Template>(response);
            const updatedTemplate: Template = {
                ...selectedTemplate,
                ...(savedTemplate || {}),
                id: savedTemplate?.id || selectedTemplate.id,
                content: payload.content
            };

            setTemplates((prev) =>
                prev.map((template) =>
                    template.id === selectedTemplate.id ||
                    (selectedTemplate.type !== 'CUSTOM' && template.type === selectedTemplate.type)
                        ? updatedTemplate
                        : template
                )
            );
            setSelectedTemplate(updatedTemplate);
            markClean();
            toast.success(`Plantilla «${selectedTemplate.name}» guardada`);
        } catch (error) {
            console.error('Error al guardar:', error);
            toast.error('Error al guardar la plantilla');
        } finally {
            setSaving(false);
        }
    }, [elements, selectedTemplate, markClean]);

    const handleSelectTemplate = useCallback(
        (id: string) => {
            if (id === selectedTemplate.id) return;
            if (!confirmDiscard()) return;
            const template = templates.find((t) => t.id === id);
            if (template) setSelectedTemplate(template);
        },
        [templates, selectedTemplate.id, confirmDiscard]
    );

    const handleDuplicateTemplate = useCallback(
        async (target: { type: string; name: string }) => {
            setSaving(true);
            try {
                const content = serializeTemplateContent(elements);
                const variables = extractTemplateVariables(content);
                await api.post('/document-templates/save', {
                    type: target.type,
                    name: target.name,
                    content,
                    variables
                });
                const duplicate: Template = {
                    id: `${target.type.toLowerCase()}_${Date.now()}`,
                    type: target.type,
                    name: target.name
                };
                setTemplates((prev) => [...prev, duplicate]);
                setSelectedTemplate(duplicate);
                setShowDuplicateDialog(false);
                toast.success(`Plantilla duplicada como «${target.name}»`);
            } catch (error) {
                console.error('Error al duplicar:', error);
                toast.error('Error al duplicar la plantilla');
            } finally {
                setSaving(false);
            }
        },
        [elements]
    );

    const handleGenerateFromEmployee = useCallback(() => {
        if (!selectedEmployeeId) {
            toast.error('Selecciona un empleado');
            return;
        }
        const employee = employees.find((e) => e.id === selectedEmployeeId);
        if (!employee) return;

        setVariableContext({
            'empleado.id': employee.id,
            'empleado.dni': employee.dni,
            'empleado.nombreCompleto': employee.nombreCompleto,
            'empleado.puesto': employee.puesto,
            'empleado.fechaAlta': employee.fechaAlta,
            'empleado.tipoContrato': employee.tipoContrato || 'Indefinido',
            'firma.fecha': new Date().toLocaleDateString('es-ES'),
            'fechaActual': new Date().toLocaleDateString('es-ES')
        });
        setShowGenerateModal(false);
        setSelectedEmployeeId('');
        toast.success(`Documento generado para ${employee.nombreCompleto}`);
    }, [selectedEmployeeId, employees]);

    const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setLogoUrl(e.target?.result as string);
                toast.success('Logo subido correctamente');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveLogo = () => {
        setLogoUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ---------------------------------------------------------------------------
    // Element operations
    // ---------------------------------------------------------------------------

    const generateId = () => `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const addElement = useCallback(
        (type: ElementType) => {
            const newElement: CanvasElement = {
                id: generateId(),
                type,
                x: 100,
                y: 100,
                width: type === 'line' ? 200 : 150,
                height: type === 'text' || type === 'variable' ? 40 : type === 'line' ? 2 : 100,
                content: type === 'text' ? 'Texto' : type === 'variable' ? '{{variable}}' : '',
                fontSize: type === 'text' || type === 'variable' ? 16 : undefined,
                fontWeight: type === 'text' ? 'normal' : undefined,
                color: '#1e293b',
                backgroundColor: type === 'box' ? '#ffffff' : undefined,
                borderColor: type === 'box' || type === 'line' ? '#1e293b' : undefined,
                borderWidth: type === 'box' ? 1 : undefined
            };
            setElements((prev) => [...prev, newElement]);
            setSelectedId(newElement.id);
            markDirty();
            toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} añadido`);
        },
        [markDirty]
    );

    const updateElement = useCallback(
        (id: string, updates: Partial<CanvasElement>) => {
            setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...updates } : el)));
            markDirty();
        },
        [markDirty]
    );

    const deleteElement = useCallback(
        (id: string) => {
            setElements((prev) => prev.filter((el) => el.id !== id));
            setSelectedId((current) => (current === id ? null : current));
            markDirty();
            toast.success('Elemento eliminado');
        },
        [markDirty]
    );

    const moveLayer = useCallback(
        (id: string, direction: 'up' | 'down') => {
            setElements((prev) => {
                const index = prev.findIndex((el) => el.id === id);
                if (index < 0) return prev;
                const newIndex = direction === 'up' ? index + 1 : index - 1;
                if (newIndex < 0 || newIndex >= prev.length) return prev;
                const next = [...prev];
                [next[index], next[newIndex]] = [next[newIndex], next[index]];
                return next;
            });
            markDirty();
        },
        [markDirty]
    );

    const insertVariableIntoSelection = useCallback(
        (key: string) => {
            if (!selectedId) {
                toast.error('Selecciona primero un elemento de tipo texto o variable');
                return;
            }
            const target = elements.find((el) => el.id === selectedId);
            if (!target || (target.type !== 'text' && target.type !== 'variable')) {
                toast.error('Las variables solo se insertan en elementos de texto o variable');
                return;
            }
            updateElement(selectedId, { content: `${target.content || ''}{{${key}}}` });
        },
        [elements, selectedId, updateElement]
    );

    const selectedElement = useMemo(
        () => elements.find((el) => el.id === selectedId) || null,
        [elements, selectedId]
    );

    const handleZoom = (delta: number) => setZoom((prev) => Math.min(Math.max(prev + delta, 50), 200));

    const handleDiscardChanges = useCallback(() => {
        if (!confirmDiscard()) return;
        setElements(createElementsForTemplate(selectedTemplate));
        setSelectedId(null);
        markClean();
    }, [selectedTemplate, confirmDiscard, markClean]);

    return (
        <div className="flex h-screen flex-col bg-slate-50">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                aria-hidden="true"
            />

            <TopBar
                templates={templates}
                selectedTemplate={selectedTemplate}
                loadingTemplates={loadingTemplates}
                saving={saving}
                dirty={isDirty}
                logoUploaded={Boolean(logoUrl)}
                onSelectTemplate={handleSelectTemplate}
                onCreateNew={() => setShowNewTemplateModal(true)}
                onUploadLogo={() => fileInputRef.current?.click()}
                onRemoveLogo={handleRemoveLogo}
                onSave={handleSave}
            />

            <UnsavedChangesBanner
                visible={isDirty}
                saving={saving}
                onSave={handleSave}
                onDiscard={handleDiscardChanges}
            />

            <div className="flex flex-1 overflow-hidden">
                <ElementToolbar onAdd={addElement} onOpenVariables={() => insertVariableIntoSelection('')} />

                <CanvasStage
                    elements={elements}
                    selectedId={selectedId}
                    zoom={zoom}
                    showGrid={showGrid}
                    logoUrl={logoUrl}
                    onSelectElement={setSelectedId}
                    onMoveElement={(id, x, y) => updateElement(id, { x, y })}
                    onMoveStart={markDirty}
                />

                <aside className="flex w-72 flex-col border-l border-slate-200 bg-white">
                    <LayersPanel
                        elements={elements}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onMove={moveLayer}
                        onDelete={deleteElement}
                    />
                    <div className="flex-1 overflow-auto">
                        <PropertiesPanel element={selectedElement} onUpdate={updateElement} onDelete={deleteElement} />
                        <VariableInspector
                            elements={elements}
                            onInsertVariable={(key) => {
                                if (!selectedElement || selectedElement.type === 'box' || selectedElement.type === 'line' || selectedElement.type === 'image') {
                                    addElement('variable');
                                    return;
                                }
                                updateElement(selectedElement.id, {
                                    content: `${selectedElement.content || ''}{{${key}}}`
                                });
                            }}
                            showGrid={showGrid}
                            onToggleGrid={() => setShowGrid((prev) => !prev)}
                        />
                    </div>
                </aside>

                <PreviewPane
                    elements={elements}
                    variableContext={variableContext}
                    employeeId={previewEmployeeId}
                    showGrid={showGrid}
                />
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    {catalogSource === 'fallback' ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                            Catálogo local (servidor no disponible)
                        </span>
                    ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                            Sincronizado con el servidor
                        </span>
                    )}
                    <span>·</span>
                    <span>{BASE_AVAILABLE_VARIABLES.length} variables disponibles</span>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={previewEmployeeId}
                        onChange={(e) => setPreviewEmployeeId(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        data-testid="preview-employee-select"
                        aria-label="Empleado para previsualizar"
                    >
                        <option value="">Datos de ejemplo</option>
                        {employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                                {employee.nombreCompleto} — {employee.dni}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => setShowDuplicateDialog(true)}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                        title="Duplicar plantilla actual en otro tipo"
                        data-testid="open-duplicate-dialog"
                    >
                        Duplicar como…
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowGenerateModal(true)}
                        className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
                        title="Generar documento desde empleado"
                    >
                        <Users size={16} />
                        Generar
                    </button>
                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                        <button
                            type="button"
                            onClick={() => handleZoom(-10)}
                            className="rounded-md p-1.5 hover:bg-white"
                            title="Zoom menos"
                            aria-label="Reducir zoom"
                        >
                            <ZoomOut size={16} className="text-slate-600" />
                        </button>
                        <span className="min-w-[50px] px-2 text-center text-sm text-slate-600">{zoom}%</span>
                        <button
                            type="button"
                            onClick={() => handleZoom(10)}
                            className="rounded-md p-1.5 hover:bg-white"
                            title="Zoom más"
                            aria-label="Aumentar zoom"
                        >
                            <ZoomIn size={16} className="text-slate-600" />
                        </button>
                    </div>
                </div>
            </div>

            {showNewTemplateModal && (
                <Modal title="Nueva plantilla" onClose={() => setShowNewTemplateModal(false)}>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                        Nombre de la plantilla
                    </label>
                    <input
                        type="text"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        placeholder="Mi nueva plantilla"
                        autoFocus
                        className="mb-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="button"
                        onClick={handleCreateNewTemplate}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        <FilePlus size={16} />
                        Crear plantilla
                    </button>
                </Modal>
            )}

            {showGenerateModal && (
                <Modal title="Generar documento" onClose={() => setShowGenerateModal(false)}>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                        Seleccionar empleado
                    </label>
                    <select
                        value={selectedEmployeeId}
                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        className="mb-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Seleccionar empleado...</option>
                        {employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                                {employee.nombreCompleto} — {employee.dni}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={handleGenerateFromEmployee}
                        disabled={!selectedEmployeeId}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:bg-slate-400"
                    >
                        <Users size={16} />
                        Generar documento
                    </button>
                </Modal>
            )}

            {showDuplicateDialog && (
                <DuplicateTemplateDialog
                    templates={templates}
                    currentType={selectedTemplate.type}
                    defaultName={`${selectedTemplate.name} (copia)`}
                    onClose={() => setShowDuplicateDialog(false)}
                    onConfirm={handleDuplicateTemplate}
                />
            )}
        </div>
    );
}

function Modal({
    title,
    onClose,
    children
}: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}) {
    return (
        <div
            role="dialog"
            aria-label={title}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50"
            onClick={onClose}
        >
            <div
                className="w-[420px] rounded-xl bg-white p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}
