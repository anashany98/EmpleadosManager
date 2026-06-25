import { useState } from 'react';
import { Copy, X } from 'lucide-react';
import type { Template } from '../templateBases';

interface DuplicateTemplateDialogProps {
    templates: Template[];
    currentType: string;
    defaultName: string;
    onClose: () => void;
    onConfirm: (target: { type: string; name: string }) => void;
}

export function DuplicateTemplateDialog({
    templates,
    currentType,
    defaultName,
    onClose,
    onConfirm
}: DuplicateTemplateDialogProps) {
    const [target, setTarget] = useState<string>(() => {
        const candidate = templates.find((template) => template.type !== currentType);
        return candidate?.type || '';
    });
    const [name, setName] = useState<string>(defaultName);

    return (
        <div
            role="dialog"
            aria-label="Duplicar plantilla"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50"
            onClick={onClose}
        >
            <div
                className="w-[420px] rounded-xl bg-white p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                data-testid="duplicate-dialog"
            >
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Copy size={18} className="text-blue-600" />
                        <h3 className="text-lg font-semibold text-slate-900">Duplicar plantilla</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="duplicate-target" className="mb-1 block text-sm font-medium text-slate-700">
                            Duplicar como tipo
                        </label>
                        <select
                            id="duplicate-target"
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {templates
                                .filter((template) => template.type !== currentType)
                                .map((template) => (
                                    <option key={template.type} value={template.type}>
                                        {template.type} — {template.name}
                                    </option>
                                ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="duplicate-name" className="mb-1 block text-sm font-medium text-slate-700">
                            Nombre de la nueva plantilla
                        </label>
                        <input
                            id="duplicate-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => target && name.trim() && onConfirm({ type: target, name: name.trim() })}
                        disabled={!target || !name.trim()}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-400"
                        data-testid="duplicate-confirm"
                    >
                        <Copy size={16} />
                        Duplicar
                    </button>
                </div>
            </div>
        </div>
    );
}
