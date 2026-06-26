import { useCallback, useState } from 'react';
import { FilePlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
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
    const { isDirty, confirmDiscard } = useUnsavedChanges();
    const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

    const handleCreateNew = useCallback(() => {
        if (!newTemplateName.trim()) { toast.error('El nombre es obligatorio'); return; }
        editor.handleCreateNewTemplate(newTemplateName.trim());
        setShowNewTemplateModal(false);
        setNewTemplateName('');
    }, [newTemplateName, editor.handleCreateNewTemplate]);

    const handleGenerate = useCallback(() => {
        if (!selectedEmployeeId) { toast.error('Selecciona un empleado'); return; }
        editor.handleGenerateFromEmployee(selectedEmployeeId);
        setShowGenerateModal(false);
        setSelectedEmployeeId('');
    }, [selectedEmployeeId, editor.handleGenerateFromEmployee]);

    return (
        <div className="flex h-screen flex-col bg-slate-50">
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

            <div className="flex flex-1 overflow-hidden">
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

                <aside className="flex w-64 flex-col border-l border-slate-200 bg-white">
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

                <PreviewPane elements={editor.elements} variableContext={editor.variableContext} employeeId={editor.previewEmployeeId} showGrid={editor.showGrid} />
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-1.5">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    {editor.catalogSource === 'fallback' ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">Local</span>
                    ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">Servidor</span>
                    )}
                    <span>·</span>
                    <span>{editor.availableVariablesCount} variables</span>
                    <span>·</span>
                    <span>{editor.elements.length} elementos</span>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={editor.previewEmployeeId}
                        onChange={(e) => editor.setPreviewEmployeeId(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="">Datos de ejemplo</option>
                        {editor.employees.map((e) => <option key={e.id} value={e.id}>{e.nombreCompleto}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowDuplicateDialog(true)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50" data-testid="open-duplicate-dialog">Duplicar</button>
                    <button type="button" onClick={() => setShowGenerateModal(true)} className="flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100">
                        <Users size={12} /> Generar
                    </button>
                </div>
            </div>

            {showNewTemplateModal && (
                <Modal title="Nueva plantilla" onClose={() => setShowNewTemplateModal(false)}>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
                    <input type="text" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="Mi plantilla" autoFocus className="mb-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    <button type="button" onClick={handleCreateNew} className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                        <FilePlus size={16} /> Crear
                    </button>
                </Modal>
            )}

            {showGenerateModal && (
                <Modal title="Generar documento" onClose={() => setShowGenerateModal(false)}>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Empleado</label>
                    <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} className="mb-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        <option value="">Seleccionar...</option>
                        {editor.employees.map((e) => <option key={e.id} value={e.id}>{e.nombreCompleto} - {e.dni}</option>)}
                    </select>
                    <button type="button" onClick={handleGenerate} disabled={!selectedEmployeeId} className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                        <Users size={16} /> Generar
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

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div role="dialog" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="w-[400px] rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                    <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
                </div>
                {children}
            </div>
        </div>
    );
}
