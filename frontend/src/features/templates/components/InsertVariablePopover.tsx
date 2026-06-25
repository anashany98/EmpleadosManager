import { useMemo, useState } from 'react';
import { Variable, X } from 'lucide-react';
import { AVAILABLE_VARIABLES } from '../templateBases';

interface InsertVariablePopoverProps {
    onInsert: (variable: string) => void;
    onClose: () => void;
}

interface VariableGroup {
    category: string;
    variables: Array<{ key: string; label: string }>;
}

const GROUPED_VARIABLES: VariableGroup[] = [
    {
        category: 'Empleado',
        variables: [
            { key: 'empleado.nombreCompleto', label: 'Nombre completo' },
            { key: 'empleado.dni', label: 'DNI' },
            { key: 'empleado.puesto', label: 'Puesto' },
            { key: 'empleado.fechaAlta', label: 'Fecha de alta' },
            { key: 'empleado.email', label: 'Email' },
            { key: 'empleado.telefono', label: 'Teléfono' }
        ]
    },
    {
        category: 'Empresa',
        variables: [
            { key: 'empresa.nombre', label: 'Nombre' },
            { key: 'empresa.cif', label: 'CIF' },
            { key: 'empresa.direccion', label: 'Dirección' }
        ]
    },
    {
        category: 'Ausencia',
        variables: [
            { key: 'ausencia.tipo', label: 'Tipo' },
            { key: 'ausencia.fechaInicio', label: 'Fecha inicio' },
            { key: 'ausencia.fechaFin', label: 'Fecha fin' },
            { key: 'ausencia.motivo', label: 'Motivo' }
        ]
    },
    {
        category: 'Dietas',
        variables: [
            { key: 'dietas.concepto', label: 'Concepto' },
            { key: 'dietas.importe', label: 'Importe' },
            { key: 'dietas.fecha', label: 'Fecha' }
        ]
    },
    {
        category: 'Firma',
        variables: [
            { key: 'firma.ciudad', label: 'Ciudad' },
            { key: 'firma.fecha', label: 'Fecha' },
            { key: 'firma.autorizante', label: 'Autorizante' }
        ]
    },
    {
        category: 'Otros',
        variables: [{ key: 'fechaActual', label: 'Fecha actual' }]
    }
];

const KNOWN_KEYS = new Set<string>(AVAILABLE_VARIABLES);

export function InsertVariablePopover({ onInsert, onClose }: InsertVariablePopoverProps) {
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return GROUPED_VARIABLES;
        return GROUPED_VARIABLES.map((group) => ({
            ...group,
            variables: group.variables.filter(
                (variable) =>
                    variable.key.toLowerCase().includes(normalized) ||
                    variable.label.toLowerCase().includes(normalized)
            )
        })).filter((group) => group.variables.length > 0);
    }, [query]);

    const unknownMatches = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return [];
        if (KNOWN_KEYS.has(query.trim())) return [];
        return [];
    }, [query]);

    return (
        <div
            role="dialog"
            aria-label="Insertar variable"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50"
            onClick={onClose}
        >
            <div
                className="flex max-h-[80vh] w-[520px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                data-testid="variable-popover"
            >
                <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                    <div className="flex items-center gap-2">
                        <Variable size={20} className="text-emerald-500" />
                        <h2 className="text-lg font-semibold text-slate-900">Insertar variable</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-100"
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </header>
                <div className="border-b border-slate-100 px-6 py-3">
                    <input
                        type="text"
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar variable (ej. empleado.dni)"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        data-testid="variable-search"
                    />
                </div>
                <div className="flex-1 overflow-auto p-4">
                    {filtered.length === 0 && unknownMatches.length === 0 && (
                        <p className="px-4 py-8 text-center text-sm text-slate-500">
                            No hay variables que coincidan con «{query}».
                        </p>
                    )}
                    <div className="space-y-4">
                        {filtered.map((group) => (
                            <section key={group.category}>
                                <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">{group.category}</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {group.variables.map((variable) => (
                                        <button
                                            key={variable.key}
                                            type="button"
                                            onClick={() => onInsert(variable.key)}
                                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
                                            data-testid={`variable-option-${variable.key}`}
                                        >
                                            <div className="font-medium text-slate-900">{variable.label}</div>
                                            <div className="mt-1 font-mono text-xs text-slate-500">{`{{${variable.key}}}`}</div>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
                <footer className="border-t border-slate-200 px-6 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
                    >
                        Cancelar
                    </button>
                </footer>
            </div>
        </div>
    );
}
