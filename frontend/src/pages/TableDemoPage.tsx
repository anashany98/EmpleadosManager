import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EditableTable, type Column } from '../components/ui/EditableTable';
import { Building2, CheckSquare, ChevronLeft, ChevronRight, Lock, Search, Square, Unlock, Users } from 'lucide-react';

// ─── Demo types & data ─────────────────────────────────────────────────

interface DemoCompany {
    id: string;
    name: string;
}

interface DemoRow {
    id: string;
    companyId: string;
    categoria: 'ENCARGADA' | 'ESPECIALISTA CONFECCIÓN' | 'AUXILIAR PRODUCCIÓN';
    precioHE: number;       // € / h extra
    precioHS: number;       // € / h extra finde/festivo
    nombre: string;
    horasExtra: number;      // h
    horasFinde: number;      // h
    totalEuros: number;      // €  (computado)
    irpf: number;            // 0..1
    tgss: number;            // 0..1
    observaciones: string;
}

const COMPANIES: DemoCompany[] = [
    { id: 'decoraciones', name: 'Decoraciones Egea S.L.' },
    { id: 'confecciones', name: 'Confecciones Mallorca S.A.' },
];

// Employees split across 2 companies to demo multi-empresa filtering.
const seed: DemoRow[] = [
    // Decoraciones Egea
    { id: '1',  companyId: 'decoraciones', categoria: 'ENCARGADA',              precioHE: 10, precioHS: 12, nombre: 'ZAMORA VALDIVIA, ADORACIÓN',       horasExtra: 0,   horasFinde: 0,   totalEuros: 0,    irpf: 0.17, tgss: 0.0635, observaciones: '' },
    { id: '2',  companyId: 'decoraciones', categoria: 'ESPECIALISTA CONFECCIÓN', precioHE: 9,  precioHS: 10, nombre: 'BAKHOUM, AMY',                    horasExtra: 12,  horasFinde: 4,   totalEuros: 148,  irpf: 0.11, tgss: 0.0635, observaciones: 'Revisado OK' },
    { id: '3',  companyId: 'decoraciones', categoria: 'ESPECIALISTA CONFECCIÓN', precioHE: 9,  precioHS: 10, nombre: 'MONZÓN LÓPEZ, ANIA MARGARITA',    horasExtra: 8.5, horasFinde: 2,   totalEuros: 96.5, irpf: 0.06, tgss: 0.0635, observaciones: '' },
    { id: '4',  companyId: 'decoraciones', categoria: 'ESPECIALISTA CONFECCIÓN', precioHE: 9,  precioHS: 10, nombre: 'AKHRIF, LOUBNA',                  horasExtra: 6,   horasFinde: 0,   totalEuros: 54,   irpf: 0.15, tgss: 0.0635, observaciones: '' },
    { id: '5',  companyId: 'decoraciones', categoria: 'ESPECIALISTA CONFECCIÓN', precioHE: 9,  precioHS: 10, nombre: 'CAMPOS GARCÍA, MARÍA ROSARIO',    horasExtra: 14,  horasFinde: 0,   totalEuros: 126,  irpf: 0.04, tgss: 0.0635, observaciones: '' },
    { id: '6',  companyId: 'decoraciones', categoria: 'ESPECIALISTA CONFECCIÓN', precioHE: 9,  precioHS: 10, nombre: 'TULCÁN PIANDA, SONIA NANCY',      horasExtra: 10,  horasFinde: 0,   totalEuros: 90,   irpf: 0.02, tgss: 0.0635, observaciones: '' },
    { id: '7',  companyId: 'decoraciones', categoria: 'ESPECIALISTA CONFECCIÓN', precioHE: 9,  precioHS: 10, nombre: 'BONILLA MENDIETA, KAREN IVONNE',  horasExtra: 7.5, horasFinde: 3,   totalEuros: 97.5, irpf: 0.12, tgss: 0.0635, observaciones: '' },
    { id: '8',  companyId: 'decoraciones', categoria: 'AUXILIAR PRODUCCIÓN',     precioHE: 9,  precioHS: 10, nombre: 'CALVO, VICTORIA',                 horasExtra: 5,   horasFinde: 0,   totalEuros: 45,   irpf: 0.02, tgss: 0.0635, observaciones: '' },
    { id: '9',  companyId: 'decoraciones', categoria: 'AUXILIAR PRODUCCIÓN',     precioHE: 9,  precioHS: 10, nombre: 'ARAGÓN VALENCIA, MARÍA ALEJANDRA',horasExtra: 11,  horasFinde: 0,   totalEuros: 99,   irpf: 0.02, tgss: 0.0635, observaciones: '' },
    { id: '10', companyId: 'decoraciones', categoria: 'AUXILIAR PRODUCCIÓN',     precioHE: 9,  precioHS: 10, nombre: 'OCAMPO MORALES, AURA MARÍA',      horasExtra: 9,   horasFinde: 0,   totalEuros: 81,   irpf: 0.02, tgss: 0.0635, observaciones: '' },
    { id: '11', companyId: 'decoraciones', categoria: 'AUXILIAR PRODUCCIÓN',     precioHE: 9,  precioHS: 10, nombre: 'MONTOYA MORENO, CARMEN JOHANA',   horasExtra: 3,   horasFinde: 0,   totalEuros: 27,   irpf: 0.02, tgss: 0.0635, observaciones: '' },
    // Confecciones Mallorca
    { id: '12', companyId: 'confecciones', categoria: 'ENCARGADA',              precioHE: 11, precioHS: 13, nombre: 'SERVERA PONS, MARGARITA',         horasExtra: 4,   horasFinde: 0,   totalEuros: 44,   irpf: 0.15, tgss: 0.0635, observaciones: '' },
    { id: '13', companyId: 'confecciones', categoria: 'ESPECIALISTA CONFECCIÓN', precioHE: 9,  precioHS: 11, nombre: 'GARCIAS CRESPÍ, ANTONIA',         horasExtra: 8,   horasFinde: 2,   totalEuros: 94,   irpf: 0.08, tgss: 0.0635, observaciones: '' },
    { id: '14', companyId: 'confecciones', categoria: 'ESPECIALISTA CONFECCIÓN', precioHE: 9,  precioHS: 11, nombre: 'PONS SALAS, CATALINA',            horasExtra: 12,  horasFinde: 0,   totalEuros: 108,  irpf: 0.10, tgss: 0.0635, observaciones: '' },
    { id: '15', companyId: 'confecciones', categoria: 'AUXILIAR PRODUCCIÓN',     precioHE: 9,  precioHS: 11, nombre: 'MATEU VIVES, FRANCISCA',          horasExtra: 6,   horasFinde: 4,   totalEuros: 86,   irpf: 0.05, tgss: 0.0635, observaciones: '' },
    { id: '16', companyId: 'confecciones', categoria: 'AUXILIAR PRODUCCIÓN',     precioHE: 9,  precioHS: 11, nombre: 'VALLS FEBRER, MARGALIDA',         horasExtra: 0,   horasFinde: 0,   totalEuros: 0,    irpf: 0.02, tgss: 0.0635, observaciones: '' },
];

// ─── Demo page ─────────────────────────────────────────────────────────

export default function TableDemoPage() {
    const STORAGE_KEY = 'demo-table-selected';
    const [rows, setRows] = useState<DemoRow[]>(seed);
    const [editable, setEditable] = useState(true);
    const [companyId, setCompanyId] = useState<string>('all');
    const [pickerOpen, setPickerOpen] = useState(true);
    const [pickerSearch, setPickerSearch] = useState('');
    // Inicial: seleccionados todos los empleados visibles
    const [selected, setSelected] = useState<Set<string>>(() => new Set(seed.map((r) => r.id)));
    // Persistencia localStorage (sobrevive a recargas)
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const arr = JSON.parse(raw) as string[];
                if (Array.isArray(arr) && arr.length > 0) setSelected(new Set(arr));
            }
        } catch {/* ignore */}
    }, []);
    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selected))); } catch {/* ignore */}
    }, [selected]);

    // Filter rows by company first
    const rowsForCompany = useMemo(
        () => (companyId === 'all' ? rows : rows.filter((r) => r.companyId === companyId)),
        [rows, companyId],
    );
    // Filter by search (case-insensitive over nombre + categoria)
    const rowsFiltered = useMemo(() => {
        const q = pickerSearch.trim().toLowerCase();
        if (!q) return rowsForCompany;
        return rowsForCompany.filter((r) =>
            r.nombre.toLowerCase().includes(q) ||
            r.categoria.toLowerCase().includes(q),
        );
    }, [rowsForCompany, pickerSearch]);
    // Then intersect with selection
    const visibleRows = useMemo(
        () => rowsForCompany.filter((r) => selected.has(r.id)),
        [rowsForCompany, selected],
    );

    const validateNonNeg = useCallback((v: unknown) => {
        if (v === null || v === '' || v === undefined) return null;
        const n = Number(v);
        if (!Number.isFinite(n)) return 'Debe ser un número';
        if (n < 0) return 'No puede ser negativo';
        if (n > 200) return 'Máximo 200h';
        return null;
    }, []);

    const handleSave = useCallback(async (rk: string | number, row: DemoRow) => {
        await new Promise((r) => setTimeout(r, 250));
        setRows((prev) => prev.map((r) => (r.id === rk ? { ...r, ...row } : r)));
    }, []);

    const handleAdd = useCallback(() => {
        const id = `new-${Date.now()}`;
        setRows((prev) => [
            ...prev,
            {
                id,
                companyId: companyId === 'all' ? 'decoraciones' : companyId,
                categoria: 'AUXILIAR PRODUCCIÓN',
                precioHE: 9,
                precioHS: 10,
                nombre: 'EMPLEADO NUEVO',
                horasExtra: 0,
                horasFinde: 0,
                totalEuros: 0,
                irpf: 0.02,
                tgss: 0.0635,
                observaciones: '',
            },
        ]);
        setSelected((s) => new Set([...s, id]));
        toast.success('Empleado añadido (recuerda rellenar el nombre)');
    }, [companyId]);

    const handleDelete = useCallback((rk: string | number) => {
        const id = String(rk);
        setRows((prev) => prev.filter((r) => r.id !== id));
        setSelected((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
        });
        toast.info('Fila eliminada (sólo en esta demo, no se guarda)');
    }, []);

    const handleChange = useCallback((rk: string | number, key: string, value: unknown) => {
        if (key === 'horasExtra' || key === 'horasFinde' || key === 'precioHE' || key === 'precioHS') {
            setRows((prev) =>
                prev.map((r) => {
                    if (r.id !== rk) return r;
                    const updated = { ...r, [key]: value };
                    updated.totalEuros = Number(
                        ((updated.horasExtra || 0) * (updated.precioHE || 0) +
                            (updated.horasFinde || 0) * (updated.precioHS || 0)).toFixed(2),
                    );
                    return updated;
                }),
            );
        }
    }, []);

    const totals: Partial<Record<string, number | string>> = {
        categoria: 'TOTAL',
        horasExtra: Number(visibleRows.reduce((s, r) => s + r.horasExtra, 0).toFixed(2)),
        horasFinde: Number(visibleRows.reduce((s, r) => s + r.horasFinde, 0).toFixed(2)),
        totalEuros: Number(visibleRows.reduce((s, r) => s + r.totalEuros, 0).toFixed(2)),
    };

    // Quitamos la columna CATEGORÍA porque ya está como group header (era
    // redundante en la pantalla). Si quieres verla como columna explícita,
    // añade la línea de vuelta.
    const columns: Column<DemoRow>[] = [
        { key: 'nombre',        header: 'Trabajador',    type: 'text',      width: 'minmax(220px, 1.5fr)' },
        { key: 'precioHE',      header: 'H.Ext. €/h',    type: 'currency',  width: '100px' },
        { key: 'precioHS',      header: 'H.S/D €/h',     type: 'currency',  width: '100px' },
        { key: 'horasExtra',    header: 'H.Ext. (h)',    type: 'number',    width: '100px', validate: validateNonNeg, decimals: 2 },
        { key: 'horasFinde',    header: 'H.S/D (h)',     type: 'number',    width: '100px', validate: validateNonNeg, decimals: 2 },
        { key: 'totalEuros',    header: 'Total €',       type: 'readonly',  width: '110px' },
        { key: 'irpf',          header: 'IRPF',          type: 'percent',   width: '80px',  decimals: 0 },
        { key: 'tgss',          header: 'TGSS',          type: 'percent',   width: '80px',  decimals: 2 },
        { key: 'observaciones', header: 'Observaciones', type: 'text',      width: 'minmax(180px, 1fr)' },
    ];

    const selectAll = () => setSelected(new Set(rowsForCompany.map((r) => r.id)));
    const selectNone = () => setSelected(new Set());
    const toggleOne = (id: string) => setSelected((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id); else n.add(id);
        return n;
    });

    const currentCompany = COMPANIES.find((c) => c.id === companyId);
    const totalInCompany = rowsForCompany.length;
    const totalSelected = visibleRows.length;
    const totalFiltered = rowsFiltered.length;

    return (
        <div className="space-y-4 p-4 md:p-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Demo · <code className="text-indigo-600">EditableTable</code>
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Componente genérico para tablas editables. Click en una celda → escribe → al perder foco se guarda con debounce.
                        Al entrar a una celda se selecciona el contenido (UX Excel) para reemplazo rápido.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setPickerOpen((v) => !v)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                    >
                        {pickerOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                        {pickerOpen ? 'Ocultar filtro' : 'Mostrar filtro'}
                    </button>
                    <button
                        onClick={() => setEditable((v) => !v)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                    >
                        {editable ? <Lock size={14} /> : <Unlock size={14} />}
                        {editable ? 'Solo lectura' : 'Editable'}
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
                {/* ── Picker lateral colapsable ── */}
                {pickerOpen && (
                    <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 self-start sticky top-4">
                        <div className="space-y-3 p-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Empresa
                                </label>
                                <select
                                    value={companyId}
                                    onChange={(e) => setCompanyId(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <option value="all">Todas</option>
                                    {COMPANIES.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Buscar empleado
                                </label>
                                <div className="mt-1 relative">
                                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={pickerSearch}
                                        onChange={(e) => setPickerSearch(e.target.value)}
                                        placeholder="Apellido, nombre, categoría…"
                                        className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={selectAll}
                                    disabled={totalSelected === totalInCompany}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                                >
                                    <CheckSquare size={12} /> Todos
                                </button>
                                <button
                                    onClick={selectNone}
                                    disabled={totalSelected === 0}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                                >
                                    <Square size={12} /> Ninguno
                                </button>
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span><Users size={11} className="inline mr-1" /> {totalSelected} / {totalInCompany}</span>
                                {pickerSearch && <span>· {totalFiltered} match</span>}
                            </div>

                            <ul className="max-h-80 space-y-0.5 overflow-y-auto pr-1 -mr-1">
                                {rowsFiltered.map((emp) => {
                                    const isOn = selected.has(emp.id);
                                    const [apellidos, ...resto] = emp.nombre.split(',');
                                    const nombre = resto.join(',').trim() || '';
                                    return (
                                        <li key={emp.id}>
                                            <label
                                                className={[
                                                    'flex items-start gap-2 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50',
                                                    isOn ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : '',
                                                ].join(' ')}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isOn}
                                                    onChange={() => toggleOne(emp.id)}
                                                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className={[
                                                        'truncate text-sm font-medium',
                                                        isOn ? 'text-slate-900 dark:text-white' : 'text-slate-400',
                                                    ].join(' ')}>
                                                        {apellidos}
                                                    </div>
                                                    {nombre && (
                                                        <div className="truncate text-xs text-slate-500">{nombre}</div>
                                                    )}
                                                </div>
                                            </label>
                                        </li>
                                    );
                                })}
                                {rowsFiltered.length === 0 && (
                                    <li className="px-2 py-4 text-center text-xs text-slate-400">
                                        Sin coincidencias
                                    </li>
                                )}
                            </ul>
                        </div>
                    </aside>
                )}

                <div>
                    <EditableTable
                        rows={visibleRows}
                        columns={columns}
                        rowKey={(r) => r.id}
                        onChange={handleChange}
                        onSave={handleSave}
                        onAddRow={handleAdd}
                        onDeleteRow={handleDelete}
                        addRowLabel="Añadir empleado"
                        readOnly={!editable}
                        totals={totals}
                        groupBy={(r) => r.categoria}
                        emptyMessage={
                            selected.size === 0
                                ? 'No hay empleados seleccionados. Marca alguno en el filtro de la izquierda.'
                                : 'No hay empleados en esta empresa.'
                        }
                    />
                </div>
            </div>

            <details className="rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">
                    ¿Qué está pasando por debajo?
                </summary>
                <ul className="mt-3 space-y-1 text-slate-600 dark:text-slate-400 list-disc list-inside">
                    <li><strong>Estado local optimista</strong>: typing actualiza una copia local al instante.</li>
                    <li><strong>Debounce 500ms al perder foco</strong>: si la validación pasa, llama a <code>onSave</code>.</li>
                    <li><strong>Select-all al focus</strong>: la primera vez que entras a una celda, se selecciona todo el contenido (estilo Excel).</li>
                    <li><strong>Recalculo en vivo</strong>: <code>totalEuros</code> se actualiza al cambiar horas o precios.</li>
                    <li><strong>Grupos</strong>: <code>groupBy</code> agrupa por categoría con cabecera azul.</li>
                    <li><strong>Totales</strong>: fila amarilla con bordes ámbar al final.</li>
                    <li><strong>Picker lateral</strong>: filtro por empresa + búsqueda por nombre/categoría. Selección se guarda en localStorage.</li>
                    <li><strong>Columna CATEGORÍA quitada</strong>: redundante con el group header. Si la quieres, añádela a <code>columns</code>.</li>
                </ul>
            </details>
        </div>
    );
}
