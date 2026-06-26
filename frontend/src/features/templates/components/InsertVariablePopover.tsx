import { useMemo, useState } from 'react';
import { Variable, X } from 'lucide-react';

interface VariableGroup {
    category: string;
    variables: Array<{ key: string; label: string }>;
}

const GROUPED_VARIABLES: VariableGroup[] = [
    {
        category: 'Empleado',
        variables: [
            { key: 'empleado.nombreCompleto', label: 'Nombre completo' },
            { key: 'empleado.nombre', label: 'Nombre' },
            { key: 'empleado.apellidos', label: 'Apellidos' },
            { key: 'empleado.dni', label: 'DNI' },
            { key: 'empleado.email', label: 'Email' },
            { key: 'empleado.telefono', label: 'Telefono' },
            { key: 'empleado.puesto', label: 'Puesto' },
            { key: 'empleado.fechaAlta', label: 'Fecha de alta' },
            { key: 'empleado.tipoContrato', label: 'Tipo contrato' },
            { key: 'empleado.nss', label: 'NSS' },
            { key: 'empleado.salarioBrutoMensual', label: 'Salario bruto mensual' }
        ]
    },
    {
        category: 'Empresa',
        variables: [
            { key: 'empresa.nombre', label: 'Nombre' },
            { key: 'empresa.cif', label: 'CIF' },
            { key: 'empresa.representanteLegal', label: 'Representante legal' },
            { key: 'empresa.direccion', label: 'Direccion' },
            { key: 'empresa.ciudad', label: 'Ciudad' },
            { key: 'empresa.email', label: 'Email' },
            { key: 'empresa.telefono', label: 'Telefono' }
        ]
    },
    {
        category: 'Ausencia',
        variables: [
            { key: 'ausencia.tipo', label: 'Tipo' },
            { key: 'ausencia.fechaInicio', label: 'Fecha inicio' },
            { key: 'ausencia.fechaFin', label: 'Fecha fin' },
            { key: 'ausencia.dias', label: 'Dias' },
            { key: 'ausencia.motivo', label: 'Motivo' }
        ]
    },
    {
        category: 'Dietas',
        variables: [
            { key: 'dietas.concepto', label: 'Concepto' },
            { key: 'dietas.importe', label: 'Importe' },
            { key: 'dietas.fecha', label: 'Fecha' },
            { key: 'dietas.kilometros', label: 'Kilometros' }
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
        variables: [
            { key: 'carta.asunto', label: 'Asunto carta' },
            { key: 'carta.contenido', label: 'Contenido carta' },
            { key: 'entrega.listado', label: 'Listado entrega' },
            { key: 'fechaActual', label: 'Fecha actual' }
        ]
    }
];

interface InsertVariablePopoverProps {
    onInsert: (variable: string) => void;
    onClose: () => void;
}

export function InsertVariablePopover({ onInsert, onClose }: InsertVariablePopoverProps) {
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return GROUPED_VARIABLES;
        return GROUPED_VARIABLES.map((group) => ({
            ...group,
            variables: group.variables.filter((v) => v.key.toLowerCase().includes(q) || v.label.toLowerCase().includes(q))
        })).filter((group) => group.variables.length > 0);
    }, [query]);

    return (
        <div role="dialog" aria-label="Insertar variable" className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
            <div className="flex max-h-[80vh] w-[540px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="variable-popover">
                <header className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
                            <Variable size={18} className="text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-[15px] font-semibold text-gray-900">Insertar variable</h2>
                            <p className="text-[11px] text-gray-400">Selecciona una variable para anadirla al documento</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600" aria-label="Cerrar">
                        <X size={18} />
                    </button>
                </header>
                <div className="border-b border-gray-100 px-6 py-3">
                    <input
                        type="text" autoFocus value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar variable... (ej. empleado.dni)"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-[13px] text-gray-700 placeholder-gray-400 transition-colors focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
                        data-testid="variable-search"
                    />
                </div>
                <div className="flex-1 overflow-auto p-5">
                    {filtered.length === 0 && (
                        <p className="px-4 py-10 text-center text-[13px] text-gray-400">No hay variables que coincidan con "{query}".</p>
                    )}
                    <div className="space-y-5">
                        {filtered.map((group) => (
                            <section key={group.category}>
                                <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{group.category}</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {group.variables.map((variable) => (
                                        <button
                                            key={variable.key}
                                            type="button"
                                            onClick={() => onInsert(variable.key)}
                                            className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-left transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm active:scale-[0.98]"
                                            data-testid={`variable-option-${variable.key}`}
                                        >
                                            <div className="text-[12px] font-medium text-gray-700">{variable.label}</div>
                                            <div className="mt-0.5 font-mono text-[10px] text-gray-400">{`{{${variable.key}}}`}</div>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
                <footer className="border-t border-gray-100 px-6 py-3">
                    <button type="button" onClick={onClose} className="w-full rounded-xl bg-gray-100 px-4 py-2.5 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200">
                        Cerrar
                    </button>
                </footer>
            </div>
        </div>
    );
}
