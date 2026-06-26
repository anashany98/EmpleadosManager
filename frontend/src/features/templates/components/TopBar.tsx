import { FilePlus, FileText, Save, Upload, X, Undo2, Redo2, Eye, EyeOff } from 'lucide-react';
import type { Template } from '../templateBases';

interface TopBarProps {
    templates: Template[];
    selectedTemplate: Template;
    loadingTemplates: boolean;
    saving: boolean;
    dirty: boolean;
    logoUploaded: boolean;
    zoom: number;
    showGrid: boolean;
    canUndo: boolean;
    canRedo: boolean;
    onSelectTemplate: (id: string) => void;
    onCreateNew: () => void;
    onUploadLogo: () => void;
    onRemoveLogo: () => void;
    onSave: () => void;
    onZoom: (delta: number) => void;
    onToggleGrid: () => void;
    onUndo: () => void;
    onRedo: () => void;
}

export function TopBar({
    templates,
    selectedTemplate,
    loadingTemplates,
    saving,
    dirty,
    logoUploaded,
    zoom,
    showGrid,
    canUndo,
    canRedo,
    onSelectTemplate,
    onCreateNew,
    onUploadLogo,
    onRemoveLogo,
    onSave,
    onZoom,
    onToggleGrid,
    onUndo,
    onRedo
}: TopBarProps) {
    return (
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
                    <FileText className="text-indigo-600" size={20} />
                    <span className="text-sm font-bold text-slate-800">Plantillas</span>
                </div>
                <select
                    value={selectedTemplate.id}
                    onChange={(e) => onSelectTemplate(e.target.value)}
                    disabled={loadingTemplates}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    data-testid="template-select"
                >
                    {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                            {template.name}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={onCreateNew}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300"
                    title="Nueva plantilla"
                    data-testid="new-template"
                >
                    <FilePlus size={15} />
                    Nueva
                </button>
            </div>

            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Deshacer (Ctrl+Z)"
                >
                    <Undo2 size={16} />
                </button>
                <button
                    type="button"
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Rehacer (Ctrl+Y)"
                >
                    <Redo2 size={16} />
                </button>

                <div className="w-px h-5 bg-slate-200 mx-1" />

                <button
                    type="button"
                    onClick={onToggleGrid}
                    className={`rounded-lg p-2 transition-colors ${showGrid ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
                    title={showGrid ? 'Ocultar cuadrícula' : 'Mostrar cuadrícula'}
                >
                    {showGrid ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>

                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-0.5">
                    <button
                        type="button"
                        onClick={() => onZoom(-10)}
                        className="rounded-md px-2 py-1 text-sm font-medium text-slate-600 hover:bg-white"
                        title="Zoom menos"
                    >
                        −
                    </button>
                    <span className="min-w-[44px] text-center text-xs font-semibold text-slate-700">{zoom}%</span>
                    <button
                        type="button"
                        onClick={() => onZoom(10)}
                        className="rounded-md px-2 py-1 text-sm font-medium text-slate-600 hover:bg-white"
                        title="Zoom más"
                    >
                        +
                    </button>
                </div>

                <div className="w-px h-5 bg-slate-200 mx-1" />

                {logoUploaded ? (
                    <button
                        type="button"
                        onClick={onRemoveLogo}
                        className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                        title="Quitar logo"
                    >
                        <X size={14} />
                        Logo
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onUploadLogo}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                        title="Subir logo"
                    >
                        <Upload size={14} />
                        Logo
                    </button>
                )}

                <button
                    type="button"
                    onClick={onSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
                    data-testid="save-button"
                >
                    <Save size={15} />
                    {saving ? 'Guardando...' : dirty ? 'Guardar' : 'Guardado'}
                </button>
            </div>
        </div>
    );
}
