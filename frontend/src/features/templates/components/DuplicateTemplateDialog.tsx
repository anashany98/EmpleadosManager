import { useState } from 'react';
import { Copy, X } from 'lucide-react';
import type { Template } from './types';

interface DuplicateTemplateDialogProps {
    templates: Template[];
    currentType: string;
    defaultName: string;
    onClose: () => void;
    onConfirm: (target: { type: string; name: string }) => void;
}

export function DuplicateTemplateDialog({ templates, currentType, defaultName, onClose, onConfirm }: DuplicateTemplateDialogProps) {
    const [target, setTarget] = useState<string>(() => {
        const candidate = templates.find((t) => t.type !== currentType);
        return candidate?.type || '';
    });
    const [name, setName] = useState(defaultName);

    return (
        <div role="dialog" aria-label="Duplicar plantilla" className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
            <div className="w-[440px] rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="duplicate-dialog">
                <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
                            <Copy size={18} className="text-indigo-600" />
                        </div>
                        <h3 className="text-[16px] font-semibold text-gray-900">Duplicar plantilla</h3>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600" aria-label="Cerrar">
                        <X size={18} />
                    </button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="duplicate-target" className="mb-1.5 block text-[12px] font-semibold text-gray-600">Duplicar como tipo</label>
                        <select id="duplicate-target" value={target} onChange={(e) => setTarget(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-700 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100">
                            {templates.filter((t) => t.type !== currentType).map((t) => (
                                <option key={t.type} value={t.type}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="duplicate-name" className="mb-1.5 block text-[12px] font-semibold text-gray-600">Nombre de la nueva plantilla</label>
                        <input id="duplicate-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-700 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-50">
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => target && name.trim() && onConfirm({ type: target, name: name.trim() })}
                            disabled={!target || !name.trim()}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                            data-testid="duplicate-confirm"
                        >
                            <Copy size={15} />
                            Duplicar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
