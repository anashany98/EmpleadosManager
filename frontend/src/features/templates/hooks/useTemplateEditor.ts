import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../../api/client';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';
import {
    AVAILABLE_VARIABLES,
    DEFAULT_TEMPLATES,
    createElementsForTemplate,
    mergeTemplatesWithDefaults,
    serializeTemplateContent
} from '../templateBases';
import type { CanvasElement, Employee, Template } from '../components/types';
import { extractTemplateVariables } from '../templateVariables';
import { useCanvasHistory } from './useCanvasHistory';

function extractList<T>(response: unknown): T[] {
    if (Array.isArray(response)) return response as T[];
    const data = (response as { data?: unknown } | null)?.data;
    if (Array.isArray(data)) return data as T[];
    const nested = (data as { data?: unknown } | null)?.data;
    return Array.isArray(nested) ? (nested as T[]) : [];
}

function extractItem<T>(response: unknown): T | null {
    const data = (response as { data?: unknown } | null)?.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as T;
    return response && typeof response === 'object' && !Array.isArray(response) ? (response as T) : null;
}

const generateId = () => `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function useTemplateEditor() {
    const [selectedTemplate, setSelectedTemplate] = useState<Template>(DEFAULT_TEMPLATES[0]);
    const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [saving, setSaving] = useState(false);
    const [zoom, setZoom] = useState(100);
    const [showGrid, setShowGrid] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [variableContext, setVariableContext] = useState<Record<string, unknown>>({});
    const [previewEmployeeId, setPreviewEmployeeId] = useState<string>('');
    const [catalogSource, setCatalogSource] = useState<'backend' | 'fallback'>('fallback');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { isDirty, markDirty, markClean, confirmDiscard } = useUnsavedChanges();
    const history = useCanvasHistory(DEFAULT_TEMPLATES[0] ? createElementsForTemplate(DEFAULT_TEMPLATES[0]) : []);

    const selectedElement = useMemo(
        () => history.elements.find((el) => el.id === selectedId) || null,
        [history.elements, selectedId]
    );

    useEffect(() => {
        const fetchTemplates = async () => {
            setLoadingTemplates(true);
            try {
                const [catalogRes, storedRes] = await Promise.all([
                    api.get<unknown>('/document-templates/list'),
                    api.get<unknown>('/document-templates/stored')
                ]);
                const remote = [...extractList<Template>(catalogRes), ...extractList<Template>(storedRes)];
                const merged = mergeTemplatesWithDefaults(remote);
                if (merged.length > 0) {
                    setTemplates(merged);
                    setSelectedTemplate((cur) => merged.find((t) => t.type === cur.type) || merged[0]);
                    setCatalogSource('backend');
                }
            } catch {
                toast.warning('No se pudo conectar con el servidor. Mostrando Catálogo local.');
                setCatalogSource('fallback');
            } finally {
                setLoadingTemplates(false);
            }
        };
        void fetchTemplates();
    }, []);

    useEffect(() => {
        if (!selectedTemplate) return;
        const els = createElementsForTemplate(selectedTemplate);
        history.reset(els);
        setSelectedId(null);
    }, [selectedTemplate?.id, selectedTemplate?.type]);

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const res = await api.get<unknown>('/employees');
                setEmployees(extractList<Employee>(res));
            } catch { /* ignore */ }
        };
        void fetchEmployees();
    }, []);

    useEffect(() => {
        if (!previewEmployeeId) { setVariableContext({}); return; }
        const fetchContext = async () => {
            try {
                const res = await api.get<{ data?: { exampleContext?: Record<string, unknown> } } | Record<string, unknown>>(
                    `/document-templates/variables?employeeId=${previewEmployeeId}`
                );
                const data = extractItem<{ exampleContext?: Record<string, unknown> }>(res);
                if (data?.exampleContext) setVariableContext(data.exampleContext);
            } catch { /* ignore */ }
        };
        void fetchContext();
    }, [previewEmployeeId]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedId) {
                    history.set((prev) => prev.filter((el) => el.id !== selectedId));
                    setSelectedId(null);
                    markDirty();
                }
            }
            if (e.key === 'Escape') setSelectedId(null);
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') { e.preventDefault(); const r = history.undo(); if (r) markDirty(); }
                if (e.key === 'y') { e.preventDefault(); const r = history.redo(); if (r) markDirty(); }
            }
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedId) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                const dir = e.key === 'ArrowUp' ? [0, -step] : e.key === 'ArrowDown' ? [0, step] : e.key === 'ArrowLeft' ? [-step, 0] : [step, 0];
                history.set((prev) => prev.map((el) => el.id === selectedId ? { ...el, x: el.x + dir[0], y: el.y + dir[1] } : el));
                markDirty();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedId, history, markDirty]);

    const addElement = useCallback((type: CanvasElement['type']) => {
        const el: CanvasElement = {
            id: generateId(), type, x: 100, y: 100,
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
        history.set((prev) => [...prev, el]);
        setSelectedId(el.id);
        markDirty();
    }, [history, markDirty]);

    const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
        history.setImmediate((prev) => prev.map((el) => (el.id === id ? { ...el, ...updates } : el)));
        markDirty();
    }, [history, markDirty]);

    const updateElementBatch = useCallback((id: string, updates: Partial<CanvasElement>) => {
        history.set((prev) => prev.map((el) => (el.id === id ? { ...el, ...updates } : el)));
        markDirty();
    }, [history, markDirty]);

    const deleteElement = useCallback((id: string) => {
        history.set((prev) => prev.filter((el) => el.id !== id));
        setSelectedId((cur) => (cur === id ? null : cur));
        markDirty();
    }, [history, markDirty]);

    const moveLayer = useCallback((id: string, direction: 'up' | 'down') => {
        history.set((prev) => {
            const idx = prev.findIndex((el) => el.id === id);
            if (idx < 0) return prev;
            const newIdx = direction === 'up' ? idx + 1 : idx - 1;
            if (newIdx < 0 || newIdx >= prev.length) return prev;
            const next = [...prev];
            [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
            return next;
        });
        markDirty();
    }, [history, markDirty]);

    const insertVariable = useCallback((key: string) => {
        if (!selectedId) { toast.error('Selecciona un elemento de texto'); return; }
        const target = history.elements.find((el) => el.id === selectedId);
        if (!target || (target.type !== 'text' && target.type !== 'variable')) { toast.error('Solo en elementos de texto'); return; }
        updateElement(selectedId, { content: `${target.content || ''}{{${key}}}` });
    }, [history.elements, selectedId, updateElement]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            const content = serializeTemplateContent(history.elements);
            const variables = extractTemplateVariables(content);
            const payload = { type: selectedTemplate.type, name: selectedTemplate.name, content, variables };
            const res = await api.post<unknown>('/document-templates/save', payload);
            const saved = extractItem<Template>(res);
            const updated: Template = { ...selectedTemplate, ...(saved || {}), id: saved?.id || selectedTemplate.id, content: payload.content };
            setTemplates((prev) => prev.map((t) => t.id === selectedTemplate.id || (selectedTemplate.type !== 'CUSTOM' && t.type === selectedTemplate.type) ? updated : t));
            setSelectedTemplate(updated);
            markClean();
            toast.success('Plantilla guardada');
        } catch {
            toast.error('Error al guardar');
        } finally {
            setSaving(false);
        }
    }, [history.elements, selectedTemplate, markClean]);

    const handleSelectTemplate = useCallback((id: string) => {
        if (id === selectedTemplate.id) return;
        if (!confirmDiscard()) return;
        const template = templates.find((t) => t.id === id);
        if (template) setSelectedTemplate(template);
    }, [templates, selectedTemplate.id, confirmDiscard]);

    const handleCreateNewTemplate = useCallback((name: string) => {
        const newTemplate: Template = { id: `custom_${Date.now()}`, name: name.trim(), type: 'CUSTOM' };
        setTemplates((prev) => [...prev, newTemplate]);
        setSelectedTemplate(newTemplate);
        history.reset([]);
        toast.success(`Plantilla "${name}" creada`);
    }, [history]);

    const handleDuplicateTemplate = useCallback(async (target: { type: string; name: string }) => {
        setSaving(true);
        try {
            const content = serializeTemplateContent(history.elements);
            const variables = extractTemplateVariables(content);
            await api.post('/document-templates/save', { type: target.type, name: target.name, content, variables });
            const duplicate: Template = { id: `${target.type.toLowerCase()}_${Date.now()}`, type: target.type, name: target.name };
            setTemplates((prev) => [...prev, duplicate]);
            setSelectedTemplate(duplicate);
            toast.success(`Duplicada como "${target.name}"`);
        } catch {
            toast.error('Error al duplicar');
        } finally {
            setSaving(false);
        }
    }, [history.elements]);

    const handleGenerateFromEmployee = useCallback((employeeId: string) => {
        const employee = employees.find((e) => e.id === employeeId);
        if (!employee) return;
        setVariableContext({
            'empleado.id': employee.id, 'empleado.dni': employee.dni,
            'empleado.nombreCompleto': employee.nombreCompleto, 'empleado.puesto': employee.puesto,
            'empleado.fechaAlta': employee.fechaAlta, 'empleado.tipoContrato': employee.tipoContrato || 'Indefinido',
            'firma.fecha': new Date().toLocaleDateString('es-ES'), 'fechaActual': new Date().toLocaleDateString('es-ES')
        });
        toast.success(`Documento generado para ${employee.nombreCompleto}`);
    }, [employees]);

    const handleDiscardChanges = useCallback(() => {
        if (!confirmDiscard()) return;
        const els = createElementsForTemplate(selectedTemplate);
        history.reset(els);
        setSelectedId(null);
        markClean();
    }, [selectedTemplate, confirmDiscard, history, markClean]);

    const handleZoom = useCallback((delta: number) => setZoom((prev) => Math.min(Math.max(prev + delta, 30), 200)), []);

    const handleLogoUpload = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => { setLogoUrl(e.target?.result as string); toast.success('Logo subido'); };
        reader.readAsDataURL(file);
    }, []);

    const handleRemoveLogo = useCallback(() => {
        setLogoUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    return {
        elements: history.elements,
        selectedId, setSelectedId,
        selectedTemplate, setSelectedTemplate: handleSelectTemplate,
        templates, loadingTemplates,
        saving, isDirty,
        zoom, handleZoom,
        showGrid, setShowGrid,
        logoUrl, fileInputRef,
        employees,
        variableContext, previewEmployeeId, setPreviewEmployeeId,
        catalogSource,
        selectedElement,
        canUndo: history.canUndo,
        canRedo: history.canRedo,
        undo: history.undo,
        redo: history.redo,
        addElement,
        updateElement,
        updateElementBatch,
        deleteElement,
        moveLayer,
        insertVariable,
        handleSave,
        handleCreateNewTemplate,
        handleDuplicateTemplate,
        handleGenerateFromEmployee,
        handleDiscardChanges,
        handleLogoUpload,
        handleRemoveLogo,
        availableVariablesCount: AVAILABLE_VARIABLES.length
    };
}
