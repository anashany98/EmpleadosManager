import { useCallback, useState, useRef, useEffect } from 'react';
import {
    Type,
    Variable,
    Square,
    Minus,
    Image,
    Layers,
    Save,
    Eye,
    ZoomIn,
    ZoomOut,
    Trash2,
    Move,
    FileText,
    X,
    ChevronUp,
    ChevronDown,
    Download,
    Upload,
    Users,
    FilePlus
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import {
    AVAILABLE_VARIABLES as BASE_AVAILABLE_VARIABLES,
    DEFAULT_TEMPLATES as BASE_DEFAULT_TEMPLATES,
    createElementsForTemplate,
    mergeTemplatesWithDefaults,
    serializeTemplateContent
} from './templateBases';

type ElementType = 'text' | 'variable' | 'box' | 'line' | 'image' | 'logo';

interface CanvasElement {
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

interface Template {
    id: string;
    name: string;
    type: string;
    content?: string;
}

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

    const nestedData = (data as { data?: unknown } | null)?.data;
    return Array.isArray(nestedData) ? nestedData as T[] : [];
};

const extractItem = <T,>(response: unknown): T | null => {
    const data = (response as { data?: unknown } | null)?.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as T;
    return response && typeof response === 'object' && !Array.isArray(response) ? response as T : null;
};

export default function CanvaEditor() {
    const [elements, setElements] = useState<CanvasElement[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<Template>(BASE_DEFAULT_TEMPLATES[0]);
    const [zoom, setZoom] = useState(100);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [draggedElement, setDraggedElement] = useState<string | null>(null);
    const [isPreviewMode, setIsPreviewMode] = useState(false);
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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

    // Cargar plantillas del backend
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
                const mergedTemplates = mergeTemplatesWithDefaults(remoteTemplates);

                if (mergedTemplates.length > 0) {
                    setTemplates(mergedTemplates);
                    setSelectedTemplate(current =>
                        mergedTemplates.find(template => template.type === current.type) || mergedTemplates[0]
                    );
                }
            } catch (error) {
                console.warn('Usando plantillas locales:', error);
            } finally {
                setLoadingTemplates(false);
            }
        };
        fetchTemplates();
    }, []);

    // Cargar elementos cuando cambia la plantilla
    useEffect(() => {
        if (!selectedTemplate) return;
        setElements(createElementsForTemplate(selectedTemplate));
        setSelectedId(null);
    }, [selectedTemplate]);

    // Cargar empleados para generar documentos
    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const response = await api.get<unknown>('/employees');
                setEmployees(extractList<Employee>(response));
            } catch (error) {
                console.warn('Error al cargar empleados:', error);
            }
        };
        fetchEmployees();
    }, []);

    // Manejar creación de nueva plantilla
    const handleCreateNewTemplate = () => {
        if (!newTemplateName.trim()) {
            toast.error('El nombre de la plantilla es obligatorio');
            return;
        }
        const newTemplate: Template = {
            id: `custom_${Date.now()}`,
            name: newTemplateName.trim(),
            type: 'CUSTOM'
        };
        setTemplates(prev => [...prev, newTemplate]);
        setSelectedTemplate(newTemplate);
        setElements([]);
        setShowNewTemplateModal(false);
        setNewTemplateName('');
        toast.success(`Plantilla "${newTemplateName}" creada`);
    };

    // Guardar plantilla al backend
    const handleSave = async () => {
        setSaving(true);
        try {
            // Extraer variables de los elementos (patrones {{variable}})
            const extractVariables = (elements: CanvasElement[]): string[] => {
                const variableSet = new Set<string>();
                elements.forEach(el => {
                    if (el.content) {
                        const matches = el.content.match(/\{\{([\w.]+)\}\}/g);
                        if (matches) {
                            matches.forEach(match => {
                                const variable = match.replace(/^\{\{|\}\}$/g, '');
                                variableSet.add(variable);
                            });
                        }
                    }
                });
                return Array.from(variableSet);
            };

            const variables = extractVariables(elements);

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

            setTemplates(prev => prev.map(template =>
                template.id === selectedTemplate.id || (selectedTemplate.type !== 'CUSTOM' && template.type === selectedTemplate.type)
                    ? updatedTemplate
                    : template
            ));
            setSelectedTemplate(updatedTemplate);
            toast.success(`Plantilla "${selectedTemplate.name}" guardada`);
        } catch (error) {
            console.error('Error al guardar:', error);
            toast.error('Error al guardar la plantilla');
        } finally {
            setSaving(false);
        }
    };

    // Generar documento desde empleado
    const handleGenerateFromEmployee = () => {
        if (!selectedEmployeeId) {
            toast.error('Selecciona un empleado');
            return;
        }
        const employee = employees.find(e => e.id === selectedEmployeeId);
        if (!employee) return;

        // Establecer contexto de variables con datos del empleado
        setVariableContext({
            'empleado.id': employee.id,
            'empleado.dni': employee.dni,
            'empleado.nombreCompleto': employee.nombreCompleto,
            'empleado.puesto': employee.puesto,
            'empleado.fechaAlta': employee.fechaAlta,
            'empleado.tipoContrato': employee.tipoContrato || 'Indefinido',
            'empresa.nombre': 'Mi Empresa SL',
            'empresa.cif': 'B12345678',
            'empresa.direccion': 'Calle Principal 123',
            'firma.fecha': new Date().toLocaleDateString('es-ES'),
            'firma.autorizante': 'Director RRHH',
            'fechaActual': new Date().toLocaleDateString('es-ES')
        });
        setShowGenerateModal(false);
        setSelectedEmployeeId('');
        toast.success(`Documento generado para ${employee.nombreCompleto}`);
    };

    // Manejar subida de logo
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setLogoUrl(event.target?.result as string);
                toast.success('Logo subido correctamente');
            };
            reader.readAsDataURL(file);
        }
    };

    // Eliminar logo
    const handleRemoveLogo = () => {
        setLogoUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const selectedElement = elements.find(el => el.id === selectedId);

    const generateId = () => `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const addElement = useCallback((type: ElementType) => {
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

        setElements(prev => [...prev, newElement]);
        setSelectedId(newElement.id);
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} añadido`);
    }, []);

    const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
        setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
    }, []);

    const deleteElement = useCallback((id: string) => {
        setElements(prev => prev.filter(el => el.id !== id));
        if (selectedId === id) {
            setSelectedId(null);
        }
        toast.success('Elemento eliminado');
    }, [selectedId]);

    const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
        e.stopPropagation();
        setSelectedId(elementId);
        setIsDragging(true);
        setDraggedElement(elementId);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging || !draggedElement) return;

        const deltaX = (e.clientX - dragStart.x) / (zoom / 100);
        const deltaY = (e.clientY - dragStart.y) / (zoom / 100);

        const element = elements.find(el => el.id === draggedElement);
        if (element) {
            updateElement(draggedElement, {
                x: element.x + deltaX,
                y: element.y + deltaY
            });
            setDragStart({ x: e.clientX, y: e.clientY });
        }
    }, [isDragging, draggedElement, dragStart, zoom, elements, updateElement]);

    const handleMouseUp = () => {
        setIsDragging(false);
        setDraggedElement(null);
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (e.target === canvasRef.current) {
            setSelectedId(null);
        }
    };

    // PREVIEW MEJORADO - Descargar como PNG con html2canvas
    const handlePreview = async () => {
        if (!canvasRef.current) return;
        
        try {
            const html2canvas = (await import('html2canvas')).default;
            
            const canvas = await html2canvas(canvasRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            
            // Nombre de archivo: {nombrePlantilla}_{fecha}.png
            const fecha = new Date().toISOString().split('T')[0];
            const nombreArchivo = `${selectedTemplate.name.replace(/\s+/g, '_')}_${fecha}.png`;
            
            const link = document.createElement('a');
            link.download = nombreArchivo;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            toast.success('Vista previa descargada');
        } catch (error) {
            console.error('Error al generar preview:', error);
            window.print();
        }
    };

    const handleDownloadPDF = async () => {
        // Usar la misma función que preview
        await handlePreview();
    };

    const handleZoom = (delta: number) => {
        setZoom(prev => Math.min(Math.max(prev + delta, 50), 200));
    };

    const resolveContent = (content: string): string => {
        return content.replace(/\{\{([\w.]+)\}\}/g, (_match, key) => {
            const value = variableContext[key as keyof typeof variableContext];
            return value !== undefined ? String(value) : `{${key}}`;
        });
    };

    const moveLayer = (direction: 'up' | 'down') => {
        if (!selectedId) return;
        const index = elements.findIndex(el => el.id === selectedId);
        if (index === -1) return;

        const newElements = [...elements];
        const newIndex = direction === 'up' ? index + 1 : index - 1;

        if (newIndex < 0 || newIndex >= elements.length) return;

        [newElements[index], newElements[newIndex]] = [newElements[newIndex], newElements[index]];
        setElements(newElements);
    };

    const renderElement = (element: CanvasElement) => {
        const isSelected = selectedId === element.id;
        const resolvedContent = element.type === 'variable' ? resolveContent(element.content) : element.content;

        const style: React.CSSProperties = {
            position: 'absolute',
            left: element.x,
            top: element.y,
            width: element.type === 'line' ? `${element.width}px` : element.width,
            height: element.type === 'line' ? `${element.height}px` : element.height,
            fontSize: element.fontSize,
            fontWeight: element.fontWeight as 'normal' | 'bold' | 'lighter',
            color: element.color,
            backgroundColor: element.backgroundColor,
            borderColor: element.borderColor,
            borderWidth: element.borderWidth && element.type === 'box' ? `${element.borderWidth}px` : undefined,
            borderStyle: element.type === 'box' || element.type === 'line' ? 'solid' : undefined,
            borderRadius: element.type === 'box' ? '0px' : undefined,
            cursor: isDragging ? 'grabbing' : 'grab',
            transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
            display: 'flex',
            alignItems: 'center',
            justifyContent: element.textAlign === 'center' ? 'center' : element.textAlign === 'right' ? 'flex-end' : 'flex-start',
            textAlign: element.textAlign || 'left',
            userSelect: 'none'
        };

        if (element.type === 'image') {
            return (
                <div
                    key={element.id}
                    onMouseDown={(e) => handleMouseDown(e, element.id)}
                    style={style}
                    className={`${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''} overflow-hidden`}
                >
                    {element.src ? (
                        <img src={element.src} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                            <Image size={32} />
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div
                key={element.id}
                onMouseDown={(e) => handleMouseDown(e, element.id)}
                style={style}
                className={`${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''} transition-shadow`}
            >
                {element.type === 'line' ? (
                    <div className="w-full h-full" style={{ backgroundColor: element.borderColor }} />
                ) : (
                    <span className="px-2">{resolvedContent}</span>
                )}
            </div>
        );
    };

    if (isPreviewMode) {
        return (
            <div className="fixed inset-0 z-50 bg-slate-900/90 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-2xl w-[850px] h-[1200px] flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                            <Eye className="text-blue-600" size={20} />
                            <h2 className="text-lg font-semibold text-slate-900">Vista previa</h2>
                        </div>
                        <button
                            onClick={() => setIsPreviewMode(false)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto p-8 bg-slate-50">
                        <div
                            ref={canvasRef}
                            className="relative bg-white mx-auto shadow-lg"
                            style={{
                                width: '210mm',
                                height: '297mm',
                                backgroundColor: 'white',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                transform: `scale(${zoom / 100})`,
                                transformOrigin: 'top center',
                                backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)',
                                backgroundSize: '20px 20px'
                            }}
                        >
                            {/* MOSTRAR LOGO EN LA ESQUINA SUPERIOR */}
                            {logoUrl && (
                                <div
                                    className="absolute"
                                    style={{
                                        left: 40,
                                        top: 40,
                                        width: 100,
                                        height: 60,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '1px dashed #e2e8f0',
                                        borderRadius: 4,
                                        overflow: 'hidden'
                                    }}
                                >
                                    <img 
                                        src={logoUrl} 
                                        alt="Logo" 
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                                    />
                                </div>
                            )}
                            {elements.map(renderElement)}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <FileText className="text-blue-600" size={20} />
                        <span className="text-sm font-medium text-slate-700">Editor de plantillas</span>
                    </div>
                    <select
                        value={selectedTemplate.id}
                        onChange={(e) => {
                            const tmpl = templates.find(t => t.id === e.target.value);
                            if (tmpl) setSelectedTemplate(tmpl);
                        }}
                        disabled={loadingTemplates}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                        {templates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setShowNewTemplateModal(true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-sm font-medium transition-colors"
                        title="Nueva Plantilla"
                    >
                        <FilePlus size={16} />
                        Nueva
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    {/* BOTÓN SUBIR LOGO */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                    />
                    {logoUrl ? (
                        <button
                            onClick={handleRemoveLogo}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors"
                            title="Eliminar logo"
                        >
                            <X size={16} />
                            Logo
                        </button>
                    ) : (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg text-sm font-medium transition-colors"
                            title="Subir logo"
                        >
                            <Upload size={16} />
                            Subir Logo
                        </button>
                    )}
                    <button
                        onClick={() => setShowGenerateModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg text-sm font-medium transition-colors"
                        title="Generar desde empleado"
                    >
                        <Users size={16} />
                        Generar
                    </button>
                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                        <button
                            onClick={() => handleZoom(-10)}
                            className="p-1.5 hover:bg-white rounded-md transition-colors"
                            title="Zoom menos"
                        >
                            <ZoomOut size={16} className="text-slate-600" />
                        </button>
                        <span className="px-2 text-sm text-slate-600 font-medium min-w-[50px] text-center">
                            {zoom}%
                        </span>
                        <button
                            onClick={() => handleZoom(10)}
                            className="p-1.5 hover:bg-white rounded-md transition-colors"
                            title="Zoom más"
                        >
                            <ZoomIn size={16} className="text-slate-600" />
                        </button>
                    </div>
                    <button
                        onClick={handlePreview}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Eye size={16} />
                        Preview
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Download size={16} />
                        PDF
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Save size={16} />
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Toolbar */}
                <div className="w-16 border-r border-slate-200 bg-white flex flex-col items-center py-4 gap-2">
                    <button
                        onClick={() => addElement('text')}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition-colors"
                        title="Añadir texto"
                    >
                        <Type size={20} />
                    </button>
                    <button
                        onClick={() => addElement('variable')}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 text-slate-600 transition-colors"
                        title="Añadir variable"
                    >
                        <Variable size={20} />
                    </button>
                    <button
                        onClick={() => addElement('box')}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 hover:text-slate-700 text-slate-600 transition-colors"
                        title="Añadir caja"
                    >
                        <Square size={20} />
                    </button>
                    <button
                        onClick={() => addElement('line')}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 hover:text-slate-700 text-slate-600 transition-colors"
                        title="Añadir línea"
                    >
                        <Minus size={20} />
                    </button>
                    <button
                        onClick={() => addElement('image')}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-purple-50 hover:text-purple-600 text-slate-600 transition-colors"
                        title="Añadir imagen"
                    >
                        <Image size={20} />
                    </button>
                </div>

                {/* Canvas */}
                <main
                    className="flex-1 overflow-auto bg-slate-100 p-8"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <div
                        ref={canvasRef}
                        onClick={handleCanvasClick}
                        className="relative bg-white mx-auto shadow-lg"
                        style={{
                            width: '210mm',
                            height: '297mm',
                            backgroundColor: 'white',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            transform: `scale(${zoom / 100})`,
                            transformOrigin: 'top left',
                            backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }}
                    >
                        {elements.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                <div className="text-center">
                                    <Type size={48} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Añade elementos desde la barra lateral</p>
                                </div>
                            </div>
                        )}
                        {/* MOSTRAR LOGO EN LA ESQUINA SUPERIOR */}
                        {logoUrl && (
                            <div
                                className="absolute"
                                style={{
                                    left: 40,
                                    top: 40,
                                    width: 100,
                                    height: 60,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px dashed #e2e8f0',
                                    borderRadius: 4,
                                    overflow: 'hidden'
                                }}
                            >
                                <img 
                                    src={logoUrl} 
                                    alt="Logo" 
                                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                                />
                            </div>
                        )}
                        {elements.map(renderElement)}
                    </div>
                </main>

                {/* Right Panel */}
                <div className="w-72 border-l border-slate-200 bg-white flex flex-col">
                    {/* Layers */}
                    <div className="border-b border-slate-200">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                            <Layers size={16} className="text-slate-500" />
                            <span className="text-sm font-medium text-slate-700">Capas ({elements.length})</span>
                        </div>
                        <div className="max-h-[200px] overflow-auto">
                            {elements.length === 0 ? (
                                <div className="px-4 py-8 text-center text-slate-400 text-sm">
                                    Sin elementos
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {elements.map((el, index) => (
                                        <button
                                            key={el.id}
                                            onClick={() => setSelectedId(el.id)}
                                            className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${
                                                selectedId === el.id
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'hover:bg-slate-50 text-slate-600'
                                            }`}
                                        >
                                            {el.type === 'text' && <Type size={14} />}
                                            {el.type === 'variable' && <Variable size={14} />}
                                            {el.type === 'box' && <Square size={14} />}
                                            {el.type === 'line' && <Minus size={14} />}
                                            {el.type === 'image' && <Image size={14} />}
                                            <span className="text-xs flex-1 truncate">
                                                {el.type === 'text' && el.content}
                                                {el.type === 'variable' && el.content}
                                                {el.type === 'box' && 'Caja'}
                                                {el.type === 'line' && 'Línea'}
                                                {el.type === 'image' && 'Imagen'}
                                            </span>
                                            <span className="text-xs text-slate-400">#{index + 1}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Properties */}
                    <div className="flex-1 flex flex-col overflow-auto">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                            <Move size={16} className="text-slate-500" />
                            <span className="text-sm font-medium text-slate-700">Propiedades</span>
                        </div>
                        {selectedElement ? (
                            <div className="p-4 space-y-4">
                                {/* Layer controls */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => moveLayer('up')}
                                        disabled={elements.findIndex(el => el.id === selectedId) === elements.length - 1}
                                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 rounded-lg text-xs text-slate-600 transition-colors"
                                    >
                                        <ChevronUp size={14} />
                                        Subir
                                    </button>
                                    <button
                                        onClick={() => moveLayer('down')}
                                        disabled={elements.findIndex(el => el.id === selectedId) === 0}
                                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 rounded-lg text-xs text-slate-600 transition-colors"
                                    >
                                        <ChevronDown size={14} />
                                        Bajar
                                    </button>
                                </div>

                                {(selectedElement.type === 'text' || selectedElement.type === 'variable') && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Texto</label>
                                        {selectedElement.type === 'variable' ? (
                                            <select
                                                value={selectedElement.content.replace(/^\{\{\s*|\s*\}\}$/g, '')}
                                                onChange={(e) => updateElement(selectedElement.id, { content: `{{${e.target.value}}}` })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                            >
                                                <option value="">Seleccionar variable...</option>
                                                {BASE_AVAILABLE_VARIABLES.map(v => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                value={selectedElement.content}
                                                onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                            />
                                        )}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">X</label>
                                        <input
                                            type="number"
                                            value={Math.round(selectedElement.x)}
                                            onChange={(e) => updateElement(selectedElement.id, { x: Number(e.target.value) })}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Y</label>
                                        <input
                                            type="number"
                                            value={Math.round(selectedElement.y)}
                                            onChange={(e) => updateElement(selectedElement.id, { y: Number(e.target.value) })}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Ancho</label>
                                        <input
                                            type="number"
                                            value={selectedElement.width}
                                            onChange={(e) => updateElement(selectedElement.id, { width: Number(e.target.value) })}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Alto</label>
                                        <input
                                            type="number"
                                            value={selectedElement.height}
                                            onChange={(e) => updateElement(selectedElement.id, { height: Number(e.target.value) })}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        />
                                    </div>
                                </div>

                                {(selectedElement.type === 'text' || selectedElement.type === 'variable') && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Tamaño de fuente</label>
                                        <input
                                            type="number"
                                            value={selectedElement.fontSize || 16}
                                            onChange={(e) => updateElement(selectedElement.id, { fontSize: Number(e.target.value) })}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        />
                                    </div>
                                )}

                                {selectedElement.type === 'box' && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Color de fondo</label>
                                        <input
                                            type="color"
                                            value={selectedElement.backgroundColor || '#ffffff'}
                                            onChange={(e) => updateElement(selectedElement.id, { backgroundColor: e.target.value })}
                                            className="w-full h-10 rounded-lg cursor-pointer"
                                        />
                                    </div>
                                )}

                                {(selectedElement.type === 'box' || selectedElement.type === 'line') && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Color de borde</label>
                                        <input
                                            type="color"
                                            value={selectedElement.borderColor || '#1e293b'}
                                            onChange={(e) => updateElement(selectedElement.id, { borderColor: e.target.value })}
                                            className="w-full h-10 rounded-lg cursor-pointer"
                                        />
                                    </div>
                                )}

                                {(selectedElement.type === 'text' || selectedElement.type === 'variable') && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Color de texto</label>
                                        <input
                                            type="color"
                                            value={selectedElement.color || '#1e293b'}
                                            onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })}
                                            className="w-full h-10 rounded-lg cursor-pointer"
                                        />
                                    </div>
                                )}

                                <button
                                    onClick={() => deleteElement(selectedElement.id)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Trash2 size={16} />
                                    Eliminar elemento
                                </button>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm p-4 text-center">
                                Selecciona un elemento para editar sus propiedades
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MODAL NUEVA PLANTILLA */}
            {showNewTemplateModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center">
                    <div className="bg-white rounded-xl shadow-2xl w-[400px] p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-900">Nueva Plantilla</h3>
                            <button
                                onClick={() => {
                                    setShowNewTemplateModal(false);
                                    setNewTemplateName('');
                                }}
                                className="p-1 hover:bg-slate-100 rounded-lg"
                            >
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nombre de la plantilla
                                </label>
                                <input
                                    type="text"
                                    value={newTemplateName}
                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                    placeholder="Mi nueva plantilla"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    autoFocus
                                />
                            </div>
                            <button
                                onClick={handleCreateNewTemplate}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <FilePlus size={16} />
                                Crear Plantilla
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL GENERAR DESDE EMPLEADO */}
            {showGenerateModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center">
                    <div className="bg-white rounded-xl shadow-2xl w-[400px] p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-900">Generar Documento</h3>
                            <button
                                onClick={() => {
                                    setShowGenerateModal(false);
                                    setSelectedEmployeeId('');
                                }}
                                className="p-1 hover:bg-slate-100 rounded-lg"
                            >
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Seleccionar empleado
                                </label>
                                <select
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                >
                                    <option value="">Seleccionar empleado...</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.nombreCompleto} - {emp.dni}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={handleGenerateFromEmployee}
                                disabled={!selectedEmployeeId}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <Users size={16} />
                                Generar Documento
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
