import { useCallback, useMemo, useState } from 'react';
import { Check, ChevronDown, Eye, FilePlus, Pencil, Search, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { UnsavedChangesBanner } from '../../components/feedback/UnsavedChangesBanner';
import { useTemplateEditor } from './hooks/useTemplateEditor';
import { CanvasStage } from './components/CanvasStage';
import { ElementToolbar } from './components/ElementToolbar';
import { LayersPanel } from './components/LayersPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { TopBar } from './components/TopBar';
import { PreviewPane } from './components/PreviewPane';
import { DuplicateTemplateDialog } from './components/DuplicateTemplateDialog';
import { VariableInspector } from './components/VariableInspector';

export default function CanvaEditor() {
    const editor = useTemplateEditor();
    const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');

    const filteredEmployees = useMemo(() => {
        const query = employeeSearch.trim().toLocaleLowerCase('es');
        if (!query) return editor.employees;
        return editor.employees.filter((employee) =>
            `${employee.nombreCompleto} ${employee.dni}`.toLocaleLowerCase('es').includes(query)
        );
    }, [editor.employees, employeeSearch]);

    const handleCreateNew = useCallback(() => {
        if (!newTemplateName.trim()) { toast.error('El nombre es obligatorio'); return; }
        editor.handleCreateNewTemplate(newTemplateName.trim());
        setShowNewTemplateModal(false);
        setNewTemplateName('');
    }, [newTemplateName, editor.handleCreateNewTemplate]);

    const handleGenerate = useCallback(async () => {
        if (selectedEmployeeIds.length === 0) { toast.error('Selecciona al menos un empleado'); return; }
        const completed = await editor.handleGenerateFromEmployees(selectedEmployeeIds);
        if (!completed) return;
        setShowGenerateModal(false);
        setSelectedEmployeeIds([]);
        setEmployeeSearch('');
    }, [selectedEmployeeIds, editor.handleGenerateFromEmployees]);

    const toggleEmployee = useCallback((employeeId: string) => {
        setSelectedEmployeeIds((current) =>
            current.includes(employeeId)
                ? current.filter((id) => id !== employeeId)
                : [...current, employeeId]
        );
    }, []);

    return (
        <div className="flex h-[calc(100dvh-7.5rem)] min-h-[680px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
            <input ref={editor.fileInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) editor.handleLogoUpload(f); }} className="hidden" aria-hidden="true" />

            <TopBar
                templates={editor.templates}
                selectedTemplate={editor.selectedTemplate}
                loadingTemplates={editor.loadingTemplates}
                saving={editor.saving}
                dirty={editor.isDirty}
                logoUploaded={Boolean(editor.logoUrl)}
                zoom={editor.zoom}
                showGrid={editor.showGrid}
                canUndo={editor.canUndo}
                canRedo={editor.canRedo}
                onSelectTemplate={editor.setSelectedTemplate}
                onCreateNew={() => setShowNewTemplateModal(true)}
                onUploadLogo={() => editor.fileInputRef.current?.click()}
                onRemoveLogo={editor.handleRemoveLogo}
                onSave={editor.handleSave}
                onZoom={editor.handleZoom}
                onToggleGrid={() => editor.setShowGrid((p) => !p)}
                onUndo={() => { const r = editor.undo(); if (r) editor.markDirty(); }}
                onRedo={() => { const r = editor.redo(); if (r) editor.markDirty(); }}
            />

            <UnsavedChangesBanner visible={editor.isDirty} saving={editor.saving} onSave={editor.handleSave} onDiscard={editor.handleDiscardChanges} />

            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-2">
                <div className="inline-flex rounded-lg bg-slate-100 p-1" aria-label="Modo del editor">
                    <button
                        type="button"
                        onClick={() => setEditorMode('edit')}
                        className={`flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold ${editorMode === 'edit' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <Pencil size={14} /> Editar diseño
                    </button>
                    <button
                        type="button"
                        onClick={() => setEditorMode('preview')}
                        className={`flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold ${editorMode === 'preview' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <Eye size={14} /> Vista previa
                    </button>
                </div>
                <p className="text-xs text-slate-500">
                    {editorMode === 'edit' ? 'Selecciona un elemento para editar sus propiedades.' : 'Comprueba el documento con datos reales antes de generarlo.'}
                </p>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {editorMode === 'edit' ? (
                    <>
                        <ElementToolbar onAdd={editor.addElement} onOpenVariables={() => editor.insertVariable('')} />

                        <CanvasStage
                            elements={editor.elements}
                            selectedId={editor.selectedId}
                            zoom={editor.zoom}
                            showGrid={editor.showGrid}
                            logoUrl={editor.logoUrl}
                            onSelectElement={editor.setSelectedId}
                            onMoveElement={(id, x, y) => editor.updateElement(id, { x, y })}
                            onResizeElement={(id, w, h, x, y) => editor.updateElementBatch(id, { width: w, height: h, ...(x !== undefined ? { x } : {}), ...(y !== undefined ? { y } : {}) })}
                            onMoveStart={editor.markDirty}
                        />

                        <aside className="flex w-[280px] shrink-0 flex-col border-l border-gray-200 bg-white">
                            <LayersPanel elements={editor.elements} selectedId={editor.selectedId} onSelect={editor.setSelectedId} onMove={editor.moveLayer} onDelete={editor.deleteElement} />
                            <div className="flex-1 overflow-auto">
                                <PropertiesPanel element={editor.selectedElement} onUpdate={editor.updateElementBatch} onDelete={editor.deleteElement} />
                                <VariableInspector
                                    elements={editor.elements}
                                    onInsertVariable={(key) => {
                                        if (!editor.selectedElement || editor.selectedElement.type === 'box' || editor.selectedElement.type === 'line' || editor.selectedElement.type === 'image') {
                                            editor.addElement('variable');
                                            return;
                                        }
                                        editor.updateElement(editor.selectedElement.id, { content: `${editor.selectedElement.content || ''}{{${key}}}` });
                                    }}
                                    showGrid={editor.showGrid}
                                    onToggleGrid={() => editor.setShowGrid((p) => !p)}
                                />
                            </div>
                        </aside>
                    </>
                ) : (
                    <PreviewPane
                        elements={editor.elements}
                        variableContext={editor.variableContext}
                        employeeId={editor.previewEmployeeId}
                        logoUrl={editor.logoUrl}
                        showGrid={false}
                        fullWidth
                    />
                )}
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-5 py-2">
                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    {editor.catalogSource === 'fallback' ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-700">Local</span>
                    ) : (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-700">Servidor</span>
                    )}
                    <span className="text-gray-300">·</span>
                    <span>{editor.availableVariablesCount} variables</span>
                    <span className="text-gray-300">·</span>
                    <span>{editor.elements.length} elementos</span>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={editor.previewEmployeeId}
                        onChange={(e) => editor.setPreviewEmployeeId(e.target.value)}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-600 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    >
                        <option value="">Datos de ejemplo</option>
                        {editor.employees.map((e) => <option key={e.id} value={e.id}>{e.nombreCompleto}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowDuplicateDialog(true)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50" data-testid="open-duplicate-dialog">Duplicar</button>
                    <button type="button" onClick={() => setShowGenerateModal(true)} className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100">
                        <Users size={13} /> Generar
                    </button>
                </div>
            </div>

            {showNewTemplateModal && (
                <Modal title="Nueva plantilla" onClose={() => setShowNewTemplateModal(false)}>
                    <label className="mb-1.5 block text-[12px] font-semibold text-gray-600">Nombre</label>
                    <input type="text" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="Mi plantilla" autoFocus className="mb-5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-[13px] text-gray-700 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                    <button type="button" onClick={handleCreateNew} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-indigo-700 shadow-sm hover:shadow-md">
                        <FilePlus size={16} /> Crear plantilla
                    </button>
                </Modal>
            )}

            {showGenerateModal && (
                <Modal title="Generar documentos" onClose={() => setShowGenerateModal(false)} wide>
                    <p className="mb-4 text-sm text-slate-600">Se creará un documento independiente por persona y quedará guardado en su expediente.</p>
                    {editor.isDirty && (
                        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            Guarda los cambios de la plantilla antes de generar.
                        </div>
                    )}
                    <details className="group relative mb-5">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-sm">
                            <span>{selectedEmployeeIds.length === 0 ? 'Seleccionar empleados…' : `${selectedEmployeeIds.length} empleado${selectedEmployeeIds.length === 1 ? '' : 's'} seleccionado${selectedEmployeeIds.length === 1 ? '' : 's'}`}</span>
                            <ChevronDown size={16} className="text-slate-400 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
                            <div className="relative mb-2">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={employeeSearch}
                                    onChange={(event) => setEmployeeSearch(event.target.value)}
                                    placeholder="Buscar por nombre o DNI"
                                    className="min-h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const visibleIds = filteredEmployees.map((employee) => employee.id);
                                    const allVisibleSelected = visibleIds.every((id) => selectedEmployeeIds.includes(id));
                                    setSelectedEmployeeIds((current) =>
                                        allVisibleSelected
                                            ? current.filter((id) => !visibleIds.includes(id))
                                            : Array.from(new Set([...current, ...visibleIds]))
                                    );
                                }}
                                className="mb-2 min-h-9 rounded-md px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                            >
                                {filteredEmployees.every((employee) => selectedEmployeeIds.includes(employee.id)) ? 'Quitar resultados' : 'Seleccionar resultados'}
                            </button>
                            <div className="max-h-64 overflow-y-auto">
                                {filteredEmployees.map((employee) => {
                                    const selected = selectedEmployeeIds.includes(employee.id);
                                    return (
                                        <button
                                            key={employee.id}
                                            type="button"
                                            onClick={() => toggleEmployee(employee.id)}
                                            className={`flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left ${selected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                                        >
                                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'}`}>
                                                {selected && <Check size={13} />}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{employee.nombreCompleto}</span>
                                            <span className="text-xs text-slate-500">{employee.dni || 'Sin DNI'}</span>
                                        </button>
                                    );
                                })}
                                {filteredEmployees.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No hay resultados.</p>}
                            </div>
                        </div>
                    </details>
                    <button type="button" onClick={() => void handleGenerate()} disabled={!selectedEmployeeIds.length || editor.isDirty || editor.generating} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
                        <Users size={16} /> {editor.generating ? 'Generando…' : `Generar ${selectedEmployeeIds.length || ''} documento${selectedEmployeeIds.length === 1 ? '' : 's'}`}
                    </button>
                </Modal>
            )}

            {showDuplicateDialog && (
                <DuplicateTemplateDialog
                    templates={editor.templates}
                    currentType={editor.selectedTemplate.type}
                    defaultName={`${editor.selectedTemplate.name} (copia)`}
                    onClose={() => setShowDuplicateDialog(false)}
                    onConfirm={(target) => { setShowDuplicateDialog(false); editor.handleDuplicateTemplate(target); }}
                />
            )}
        </div>
    );
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
    return (
        <div role="dialog" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
            <div className={`${wide ? 'w-[min(620px,calc(100vw-2rem))]' : 'w-[min(420px,calc(100vw-2rem))]'} max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl`} onClick={(e) => e.stopPropagation()}>
                <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-[16px] font-semibold text-gray-900">{title}</h3>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"><X size={18} /></button>
                </div>
                {children}
            </div>
        </div>
    );
}
