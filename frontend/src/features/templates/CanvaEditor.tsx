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
    const { confirmDiscard } = useUnsavedChanges();
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
        <div className="flex h-screen flex-col bg-gray-100">
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

                <aside className="flex w-[260px] flex-col border-l border-gray-200 bg-white">
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
                <Modal title="Generar documento" onClose={() => setShowGenerateModal(false)}>
                    <label className="mb-1.5 block text-[12px] font-semibold text-gray-600">Empleado</label>
                    <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} className="mb-5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-[13px] text-gray-700 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100">
                        <option value="">Seleccionar...</option>
                        {editor.employees.map((e) => <option key={e.id} value={e.id}>{e.nombreCompleto} - {e.dni}</option>)}
                    </select>
                    <button type="button" onClick={handleGenerate} disabled={!selectedEmployeeId} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-amber-600 disabled:opacity-40 shadow-sm hover:shadow-md">
                        <Users size={16} /> Generar documento
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
        <div role="dialog" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
            <div className="w-[420px] rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-[16px] font-semibold text-gray-900">{title}</h3>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"><X size={18} /></button>
                </div>
                {children}
            </div>
        </div>
    );
}
