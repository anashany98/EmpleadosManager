import { FilePlus, FileText, Save, Upload, X } from 'lucide-react';
import type { Template } from '../templateBases';

interface TopBarProps {
    templates: Template[];
    selectedTemplate: Template;
    loadingTemplates: boolean;
    saving: boolean;
    dirty: boolean;
    logoUploaded: boolean;
    onSelectTemplate: (id: string) => void;
    onCreateNew: () => void;
    onUploadLogo: () => void;
    onRemoveLogo: () => void;
    onSave: () => void;
}

export function TopBar({
    templates,
    selectedTemplate,
    loadingTemplates,
    saving,
    dirty,
    logoUploaded,
    onSelectTemplate,
    onCreateNew,
    onUploadLogo,
    onRemoveLogo,
    onSave
}: TopBarProps) {
    return (
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <FileText className="text-blue-600" size={20} />
                    <span className="text-sm font-medium text-slate-700">Editor de plantillas</span>
                </div>
                <select
                    value={selectedTemplate.id}
                    onChange={(e) => onSelectTemplate(e.target.value)}
                    disabled={loadingTemplates}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="flex items-center gap-1 rounded-lg bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                    title="Nueva plantilla"
                    data-testid="new-template"
                >
                    <FilePlus size={16} />
                    Nueva
                </button>
            </div>
            <div className="flex items-center gap-2">
                {logoUploaded ? (
                    <button
                        type="button"
                        onClick={onRemoveLogo}
                        className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                        title="Quitar logo"
                    >
                        <X size={16} />
                        Logo
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onUploadLogo}
                        className="flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-100"
                        title="Subir logo"
                    >
                        <Upload size={16} />
                        Subir Logo
                    </button>
                )}
                <button
                    type="button"
                    onClick={onSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-400"
                    data-testid="save-button"
                >
                    <Save size={16} />
                    {saving ? 'Guardando...' : dirty ? 'Guardar cambios' : 'Guardar'}
                </button>
            </div>
        </div>
    );
}
