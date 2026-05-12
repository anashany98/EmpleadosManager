import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Building2,
    Download,
    FileText,
    GripHorizontal,
    Plus,
    Printer,
    RefreshCw,
    Save,
    Search,
    Variable,
    X
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { getEmployeeDisplayName } from '../../utils/employeeDisplay';

type Template = {
    type: string;
    name: string;
    content: string;
    variables: string[];
};

type Employee = {
    id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    dni: string;
    position: string;
    startDate: string;
};

type Company = {
    name: string;
    cif: string;
    address: string;
};

type VariableContext = {
    empleado?: {
        nombreCompleto: string;
        dni: string;
        puesto: string;
        fechaAlta: string;
    };
    empresa?: Company;
    ausencia?: {
        tipo: string;
        fechaInicio: string;
        fechaFin: string;
    };
    carta?: {
        asunto: string;
        contenido: string;
    };
    dietas?: {
        concepto: string;
        importe: string;
    };
    firma?: {
        ciudad: string;
        fecha: string;
        autorizante: string;
    };
};

const AVAILABLE_VARIABLES: Array<{ category: string; variables: Array<{ key: string; label: string }> }> = [
    {
        category: 'Empleado',
        variables: [
            { key: 'empleado.nombreCompleto', label: 'Nombre completo' },
            { key: 'empleado.dni', label: 'DNI' },
            { key: 'empleado.puesto', label: 'Puesto' },
            { key: 'empleado.fechaAlta', label: 'Fecha de alta' }
        ]
    },
    {
        category: 'Empresa',
        variables: [
            { key: 'empresa.nombre', label: 'Nombre de empresa' },
            { key: 'empresa.cif', label: 'CIF' },
            { key: 'empresa.direccion', label: 'Dirección' }
        ]
    },
    {
        category: 'Ausencia',
        variables: [
            { key: 'ausencia.tipo', label: 'Tipo de ausencia' },
            { key: 'ausencia.fechaInicio', label: 'Fecha de inicio' },
            { key: 'ausencia.fechaFin', label: 'Fecha de fin' }
        ]
    },
    {
        category: 'Carta',
        variables: [
            { key: 'carta.asunto', label: 'Asunto' },
            { key: 'carta.contenido', label: 'Contenido' }
        ]
    },
    {
        category: 'Dietas',
        variables: [
            { key: 'dietas.concepto', label: 'Concepto' },
            { key: 'dietas.importe', label: 'Importe' }
        ]
    },
    {
        category: 'Firma',
        variables: [
            { key: 'firma.ciudad', label: 'Ciudad' },
            { key: 'firma.fecha', label: 'Fecha' },
            { key: 'firma.autorizante', label: 'Autorizante' }
        ]
    }
];

const extractData = <T,>(response: unknown, fallback: T): T => {
    if (typeof response !== 'object' || response === null) return fallback;
    const res = response as Record<string, unknown>;
    if (res?.data?.data !== undefined) return res.data.data as T;
    if (res?.data !== undefined) return res.data as T;
    return response as T;
};

export default function TemplatesView() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [content, setContent] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [variableContext, setVariableContext] = useState<VariableContext>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [showVariablePopup, setShowVariablePopup] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const loadCatalog = useCallback(async () => {
        try {
            const response = await api.get('/document-templates/list');
            const data = extractData<Template[]>(response, []);
            setTemplates(data);
            if (data.length > 0 && !selectedTemplate) {
                setSelectedTemplate(data[0]);
                setContent(data[0].content || '');
            }
        } catch (error) {
            console.error('Error loading catalog:', error);
            toast.error('No se pudo cargar el catálogo de plantillas');
        }
    }, [selectedTemplate]);

    const loadEmployees = useCallback(async () => {
        try {
            const response = await api.get('/employees');
            const data = extractData<Employee[]>(response, []);
            setEmployees(data);
        } catch (error) {
            console.error('Error loading employees:', error);
            toast.error('No se pudo cargar la lista de empleados');
        }
    }, []);

    const loadTemplateContent = useCallback(async (type: string) => {
        try {
            const response = await api.get(`/document-templates/${type}`);
            const data = extractData<Template>(response, { type, name: type, content: '', variables: [] });
            setSelectedTemplate(data);
            setContent(data.content || '');
        } catch (error) {
            console.error('Error loading template:', error);
            toast.error('No se pudo cargar la plantilla');
        }
    }, []);

    const loadVariableContext = useCallback(async (employeeId: string) => {
        if (!employeeId) {
            setVariableContext({});
            return;
        }
        try {
            const response = await api.get(`/document-templates/variables?employeeId=${employeeId}`);
            const data = extractData<{ exampleContext?: VariableContext }>(response, {});
            setVariableContext(data.exampleContext || {});
        } catch (error) {
            console.error('Error loading variables:', error);
            setVariableContext({});
        }
    }, []);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await Promise.all([loadCatalog(), loadEmployees()]);
            setLoading(false);
        };
        load();
    }, [loadCatalog, loadEmployees]);

    useEffect(() => {
        if (selectedTemplate) {
            loadTemplateContent(selectedTemplate.type);
        }
    }, [selectedTemplate, loadTemplateContent]);

    useEffect(() => {
        if (selectedEmployee) {
            loadVariableContext(selectedEmployee.id);
        } else {
            setVariableContext({});
        }
    }, [selectedEmployee, loadVariableContext]);

    const handleSave = async () => {
        if (!selectedTemplate) return;
        setSaving(true);
        try {
            await api.post('/document-templates/save', {
                type: selectedTemplate.type,
                name: selectedTemplate.name,
                content: content,
                variables: selectedTemplate.variables
            });
            toast.success('Plantilla guardada correctamente');
            await loadCatalog();
        } catch (error) {
            console.error('Error saving:', error);
            toast.error('No se pudo guardar la plantilla');
        } finally {
            setSaving(false);
        }
    };

    const handleGenerate = async () => {
        if (!selectedEmployee) {
            toast.error('Selecciona un empleado para generar el documento');
            return;
        }
        setGenerating(true);
        try {
            const response = await api.post('/document-templates/generate', {
                type: selectedTemplate.type,
                employeeId: selectedEmployee.id
            });
            const data = extractData<{ url?: string }>(response, {});
            if (data.url) {
                window.open(data.url, '_blank');
                toast.success('Documento generado');
            } else {
                toast.error('No se pudo generar el documento');
            }
        } catch (error) {
            console.error('Error generating:', error);
            toast.error('Error al generar el documento');
        } finally {
            setGenerating(false);
        }
    };

    const insertVariable = (variableKey: string) => {
        const variableText = `{{${variableKey}}`;
        setContent((prev) => prev + variableText);
        setShowVariablePopup(false);
    };

    const resolvePreviewContent = useCallback(() => {
        if (!content) return '';
        return content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path) => {
            const parts = path.split('.');
            let value: unknown = variableContext;
            for (const part of parts) {
                if (value && typeof value === 'object') {
                    value = (value as Record<string, unknown>)[part];
                } else {
                    return `{${path}}`;
                }
            }
            return value !== undefined && value !== null ? String(value) : `{${path}}`;
        });
    }, [content, variableContext]);

    const filteredTemplates = useMemo(() => {
        if (!searchQuery) return templates;
        const query = searchQuery.toLowerCase();
        return templates.filter(
            (t) =>
                t.name.toLowerCase().includes(query) ||
                t.type.toLowerCase().includes(query)
        );
    }, [templates, searchQuery]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-3 text-slate-500">
                    <RefreshCw className="animate-spin" size={20} />
                    <span>Cargando...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-4">
                <div className="flex items-center gap-3">
                    <FileText className="text-slate-500" size={20} />
                    <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Plantillas de documentos
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={saving || !selectedTemplate}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white rounded-xl font-medium text-sm transition-colors"
                    >
                        <Save size={16} />
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Columna 1: Lista de plantillas (25%) */}
                <aside className="w-1/4 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar plantillas..."
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-2">
                        {filteredTemplates.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                                No hay plantillas disponibles
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {filteredTemplates.map((template) => (
                                    <button
                                        key={template.type}
                                        onClick={() => setSelectedTemplate(template)}
                                        className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
                                            selectedTemplate?.type === template.type
                                                ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700 border border-transparent'
                                        }`}
                                    >
                                        <div className="font-medium text-sm text-slate-900 dark:text-white">
                                            {template.name}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            {template.type}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>

                {/* Columna 2: Editor de texto (40%) */}
                <main className="w-2/5 flex flex-col bg-slate-50 dark:bg-slate-900">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                            <GripHorizontal className="text-slate-400" size={16} />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Editor</span>
                        </div>
                        <button
                            onClick={() => setShowVariablePopup(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                        >
                            <Variable size={16} />
                            Insertar variable
                        </button>
                    </div>
                    <div className="flex-1 p-4">
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Escribe el contenido de la plantilla..."
                            className="w-full h-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none font-mono"
                        />
                    </div>
                </main>

                {/* Columna 3: Preview (35%) */}
                <aside className="w-[35%] flex flex-col border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                            <Building2 className="text-slate-400" size={16} />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Preview</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedEmployee?.id || ''}
                                onChange={(e) => {
                                    const emp = employees.find((em) => em.id === e.target.value);
                                    setSelectedEmployee(emp || null);
                                }}
                                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            >
                                <option value="">Seleccionar empleado...</option>
                                {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>
                                        {getEmployeeDisplayName(emp)}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={handleGenerate}
                                disabled={generating || !selectedEmployee}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <Download size={16} />
                                {generating ? 'Generando...' : 'Generar'}
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 p-4 overflow-auto">
                        <div className="bg-white border border-slate-200 rounded-xl p-6 min-h-[400px] shadow-sm">
                            <pre className="whitespace-pre-wrap text-sm text-slate-900 font-sans">
                                {resolvePreviewContent() || (
                                    <span className="text-slate-400 italic">
                                        Selecciona una plantilla y un empleado para ver la previsualización
                                    </span>
                                )}
                            </pre>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Popup para insertar variables */}
            {showVariablePopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-[500px] max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-2">
                                <Variable className="text-emerald-500" size={20} />
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    Insertar variable
                                </h2>
                            </div>
                            <button
                                onClick={() => setShowVariablePopup(false)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            <div className="space-y-4">
                                {AVAILABLE_VARIABLES.map((category) => (
                                    <div key={category.category}>
                                        <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">
                                            {category.category}
                                        </h3>
                                        <div className="grid grid-cols-2 gap-2">
                                            {category.variables.map((variable) => (
                                                <button
                                                    key={variable.key}
                                                    onClick={() => insertVariable(variable.key)}
                                                    className="text-left px-3 py-2 bg-slate-50 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-700 rounded-lg text-sm transition-colors"
                                                >
                                                    <div className="font-medium text-slate-900 dark:text-white">
                                                        {variable.label}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
                                                        {variable.key}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => setShowVariablePopup(false)}
                                className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-sm transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
