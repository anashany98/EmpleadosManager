import { FilePlus, FileText, Save, Upload, X, Undo2, Redo2, Grid3X3, ZoomIn, ZoomOut } from 'lucide-react';
import type { Template } from './types';

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

const TYPE_LABELS: Record<string, string> = {
    CERTIFICADO_EMPRESA: 'Cert. Empresa',
    CERTIFICADO_TRABAJO: 'Cert. Trabajo',
    CARTA_FORMAL: 'Carta',
    JUSTIFICANTE_AUSENCIA: 'Ausencia',
    VACATION_REQUEST: 'Vacaciones',
    FIRMA_DIETAS: 'Dietas',
    OBRA_EXPENSE_RECEIPT: 'Recibí obra',
    UNIFORM: 'Uniforme',
    EPI: 'EPI',
    TECH_DEVICE: 'Tecnologia',
    NDA: 'Confidencial',
    RGPD: 'RGPD',
    ENTREGA_MATERIAL: 'Material',
    CUSTOM: 'Personalizada'
};

const TYPE_COLORS: Record<string, string> = {
    CERTIFICADO_EMPRESA: 'bg-blue-50 text-blue-700 border-blue-200',
    CERTIFICADO_TRABAJO: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    CARTA_FORMAL: 'bg-violet-50 text-violet-700 border-violet-200',
    JUSTIFICANTE_AUSENCIA: 'bg-amber-50 text-amber-700 border-amber-200',
    VACATION_REQUEST: 'bg-sky-50 text-sky-700 border-sky-200',
    FIRMA_DIETAS: 'bg-orange-50 text-orange-700 border-orange-200',
    OBRA_EXPENSE_RECEIPT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    UNIFORM: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    EPI: 'bg-teal-50 text-teal-700 border-teal-200',
    TECH_DEVICE: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    NDA: 'bg-rose-50 text-rose-700 border-rose-200',
    RGPD: 'bg-pink-50 text-pink-700 border-pink-200',
    ENTREGA_MATERIAL: 'bg-lime-50 text-lime-700 border-lime-200',
    CUSTOM: 'bg-gray-50 text-gray-700 border-gray-200'
};

export function TopBar({
    templates, selectedTemplate, loadingTemplates, saving, dirty, logoUploaded,
    zoom, showGrid, canUndo, canRedo,
    onSelectTemplate, onCreateNew, onUploadLogo, onRemoveLogo, onSave, onZoom, onToggleGrid, onUndo, onRedo
}: TopBarProps) {
    return (
        <div className="border-b border-gray-200 bg-white">
            <div className="flex items-center gap-4 px-5 py-3">
                <div className="flex items-center gap-2.5 shrink-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
                        <FileText size={18} className="text-white" />
                    </div>
                    <span className="text-[15px] font-semibold text-gray-800">Plantillas</span>
                </div>

                <div className="h-6 w-px bg-gray-200 shrink-0" />

                <div className="flex-1 overflow-x-auto">
                    <div className="flex items-center gap-2 pb-0.5">
                        {loadingTemplates ? (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
                                Cargando...
                            </div>
                        ) : (
                            templates.map((t) => {
                                const isActive = t.id === selectedTemplate.id;
                                const label = TYPE_LABELS[t.type] || t.name;
                                const colorClass = TYPE_COLORS[t.type] || TYPE_COLORS.CUSTOM;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => onSelectTemplate(t.id)}
                                        className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all ${
                                            isActive
                                                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                                                : `${colorClass} hover:shadow-sm`
                                        }`}
                                        title={t.name}
                                    >
                                        {label}
                                    </button>
                                );
                            })
                        )}
                        <button
                            type="button"
                            onClick={onCreateNew}
                            className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-[12px] font-medium text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-700"
                            title="Nueva plantilla"
                            data-testid="new-template"
                        >
                            <FilePlus size={14} />
                            Nueva
                        </button>
                    </div>
                </div>

                <div className="h-6 w-px bg-gray-200 shrink-0" />

                <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={onUndo} disabled={!canUndo} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed" title="Deshacer (Ctrl+Z)">
                        <Undo2 size={16} />
                    </button>
                    <button type="button" onClick={onRedo} disabled={!canRedo} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed" title="Rehacer (Ctrl+Y)">
                        <Redo2 size={16} />
                    </button>

                    <div className="h-5 w-px bg-gray-200 mx-1" />

                    <button type="button" onClick={onToggleGrid} className={`rounded-lg p-2 transition-colors ${showGrid ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`} title={showGrid ? 'Ocultar cuadricula' : 'Mostrar cuadricula'}>
                        <Grid3X3 size={16} />
                    </button>

                    <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-0.5 py-0.5">
                        <button type="button" onClick={() => onZoom(-10)} className="rounded-md p-1.5 text-gray-500 hover:bg-white hover:text-gray-700" title="Zoom -">
                            <ZoomOut size={14} />
                        </button>
                        <span className="min-w-[40px] text-center text-[11px] font-semibold text-gray-600">{zoom}%</span>
                        <button type="button" onClick={() => onZoom(10)} className="rounded-md p-1.5 text-gray-500 hover:bg-white hover:text-gray-700" title="Zoom +">
                            <ZoomIn size={14} />
                        </button>
                    </div>

                    <div className="h-5 w-px bg-gray-200 mx-1" />

                    {logoUploaded ? (
                        <button type="button" onClick={onRemoveLogo} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-600 transition-colors hover:bg-red-100" title="Quitar logo">
                            <X size={13} /> Logo
                        </button>
                    ) : (
                        <button type="button" onClick={onUploadLogo} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700" title="Subir logo">
                            <Upload size={13} /> Logo
                        </button>
                    )}

                    <button type="button" onClick={onSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-[12px] font-semibold text-white transition-all hover:bg-indigo-700 disabled:opacity-50 shadow-sm hover:shadow-md" data-testid="save-button">
                        <Save size={14} />
                        {saving ? 'Guardando...' : dirty ? 'Guardar' : 'Guardado'}
                    </button>
                </div>
            </div>
        </div>
    );
}
