import { useCallback, useMemo, useRef, useState } from 'react';
import { Loader2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { EmptyState } from './EmptyState';

// ─── Types ──────────────────────────────────────────────────────────────

export type CellType = 'text' | 'number' | 'currency' | 'percent' | 'date' | 'select' | 'readonly';

export interface Column<T> {
    /** Unique key for the column. Used to read/write on the row object. */
    key: string;
    /** Header text. */
    header: string;
    /** Cell type. Drives default editor + formatter. */
    type: CellType;
    /** CSS width hint, e.g. "120px" or "1fr". Defaults to "minmax(96px, 1fr)". */
    width?: string;
    /** Tailwind text-align. Defaults to "left" (or "right" for numeric). */
    align?: 'left' | 'right' | 'center';
    /** Options for `type: 'select'`. */
    options?: { value: string; label: string }[];
    /** Custom read-only renderer. If provided, overrides default formatter. */
    render?: (value: unknown, row: T) => React.ReactNode;
    /** Per-cell validator. Returns an error string or null. */
    validate?: (value: unknown, row: T) => string | null;
    /** Number of decimal places for `currency` / `percent` / `number`. */
    decimals?: number;
    /** Whether the cell is editable. Defaults to true unless type==='readonly'. */
    editable?: boolean;
    /** Optional className for the cell wrapper. */
    className?: string;
}

export interface EditableTableProps<T> {
    rows: T[];
    columns: Column<T>[];
    /** Stable key extractor. */
    rowKey: (row: T) => string | number;
    /** Called when a single cell value changes locally (immediate). */
    onChange?: (rowKey: string | number, columnKey: string, value: unknown) => void;
    /**
     * Async saver for a whole row. Called on blur with debounce.
     * Throw to signal save failure (cell will be marked as error).
     */
    onSave?: (rowKey: string | number, row: T) => Promise<void> | void;
    /** Optional footer row (e.g. column totals). */
    totals?: Partial<Record<string, number | string>>;
    /** Optional group header extractor. Return null for ungrouped. */
    groupBy?: (row: T) => string | null;
    /** Loading state. Renders skeleton rows. */
    loading?: boolean;
    /** Empty state message. */
    emptyMessage?: string;
    /** Add-row handler. If absent, no "+" button is shown. */
    onAddRow?: () => void;
    /** Add-row label (default "Añadir fila"). */
    addRowLabel?: string;
    /** Delete-row handler. If absent, no trash button is shown. */
    onDeleteRow?: (rowKey: string | number) => void;
    /** Make the whole table read-only. */
    readOnly?: boolean;
    /** Debounce for save in ms. Default 500. */
    saveDelayMs?: number;
    /** Optional className for the table wrapper. */
    className?: string;
    /**
     * Optional hook called per row. Return true if the row has unsaved
     * changes (renders an amber dot next to the row key indicator).
     * Useful when the parent tracks "dirty" rows separately from the
     * internal saving/error state.
     */
    isRowDirty?: (row: T) => boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getValue<T>(row: T, key: string): unknown {
    return (row as Record<string, unknown>)[key];
}

function setValue<T>(row: T, key: string, value: unknown): T {
    return { ...row, [key]: value };
}

function formatCell(value: unknown, col: Column<unknown>): string {
    if (value === null || value === undefined || value === '') return '';
    if (col.type === 'currency' && typeof value === 'number') {
        return value.toLocaleString('es-ES', {
            minimumFractionDigits: col.decimals ?? 2,
            maximumFractionDigits: col.decimals ?? 2,
        });
    }
    if (col.type === 'percent' && typeof value === 'number') {
        return `${(value * 100).toLocaleString('es-ES', {
            minimumFractionDigits: col.decimals ?? 0,
            maximumFractionDigits: col.decimals ?? 0,
        })}%`;
    }
    if (col.type === 'number' && typeof value === 'number') {
        return value.toLocaleString('es-ES', {
            minimumFractionDigits: col.decimals ?? 0,
            maximumFractionDigits: col.decimals ?? 6,
        });
    }
    return String(value);
}

function parseInput(raw: string, col: Column<unknown>): unknown {
    if (raw === '') return null;
    if (col.type === 'number' || col.type === 'currency' || col.type === 'percent') {
        // Spanish format: comma as decimal separator, dot as thousands
        const normalized = raw.replace(/\./g, '').replace(',', '.');
        const n = Number(normalized);
        return Number.isFinite(n) ? n : raw;
    }
    return raw;
}

function alignClass(col: Column<unknown>): string {
    if (col.align) {
        return col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
    }
    if (col.type === 'currency' || col.type === 'number' || col.type === 'percent') {
        return 'text-right';
    }
    return 'text-left';
}

// ─── Component ──────────────────────────────────────────────────────────

interface CellState {
    status: 'idle' | 'saving' | 'error';
    error?: string;
}

export function EditableTable<T>(props: EditableTableProps<T>) {
    const {
        rows,
        columns,
        rowKey,
        onChange,
        onSave,
        totals,
        groupBy,
        loading = false,
        emptyMessage = 'Sin datos',
        onAddRow,
        addRowLabel = 'Añadir fila',
        onDeleteRow,
        readOnly = false,
        saveDelayMs = 500,
        className = '',
    } = props;

    // Local working copy so typing is responsive even if onChange is slow.
    const [workingRows, setWorkingRows] = useState<T[]>(rows);
    // Re-sync when the parent swaps rows (e.g. after refetch).
    // We keep a ref to the last `rows` identity to avoid loops.
    const lastRowsRef = useRef(rows);
    if (lastRowsRef.current !== rows) {
        lastRowsRef.current = rows;
        setWorkingRows(rows);
    }

    // Per-cell save state: `${rowKey}:${colKey}` -> CellState
    const [cellState, setCellState] = useState<Record<string, CellState>>({});
    const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const isEditable = (col: Column<T>) =>
        !readOnly && col.type !== 'readonly' && (col.editable ?? true);

    const handleLocalChange = useCallback(
        (rk: string | number, col: Column<T>, raw: string) => {
            const value = parseInput(raw, col);
            setWorkingRows((prev) =>
                prev.map((r) => (rowKey(r) === rk ? setValue(r, col.key, value) : r)),
            );
            onChange?.(rk, col.key, value);
            // Validate eagerly
            const err = col.validate?.(value, workingRows.find((r) => rowKey(r) === rk) as T) ?? null;
            const stateKey = `${rk}:${col.key}`;
            if (err) {
                setCellState((s) => ({ ...s, [stateKey]: { status: 'error', error: err } }));
            } else {
                setCellState((s) => ({ ...s, [stateKey]: { status: 'idle' } }));
            }
        },
        [onChange, rowKey, workingRows],
    );

    const handleBlur = useCallback(
        (rk: string | number, col: Column<T>) => {
            if (!onSave) return;
            const stateKey = `${rk}:${col.key}`;
            // Cancel any pending timer
            if (saveTimers.current[stateKey]) {
                clearTimeout(saveTimers.current[stateKey]);
            }
            // If currently in error, don't save
            if (cellState[stateKey]?.status === 'error') return;

            setCellState((s) => ({ ...s, [stateKey]: { status: 'saving' } }));

            saveTimers.current[stateKey] = setTimeout(async () => {
                const row = workingRows.find((r) => rowKey(r) === rk);
                if (!row) return;
                try {
                    await onSave(rk, row);
                    setCellState((s) => ({ ...s, [stateKey]: { status: 'idle' } }));
                } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Error al guardar';
                    setCellState((s) => ({ ...s, [stateKey]: { status: 'error', error: msg } }));
                }
            }, saveDelayMs);
        },
        [onSave, workingRows, rowKey, saveDelayMs, cellState],
    );

    // ── Grouping ───────────────────────────────────────────────────────
    type Group = { name: string; rows: T[] };
    const groups: Group[] = useMemo(() => {
        if (!groupBy) return [{ name: '', rows: workingRows }];
        const map = new Map<string, T[]>();
        for (const r of workingRows) {
            const g = groupBy(r) ?? '';
            if (!map.has(g)) map.set(g, []);
            map.get(g)!.push(r);
        }
        return Array.from(map.entries()).map(([name, rows]) => ({ name, rows }));
    }, [workingRows, groupBy]);

    // ── Render ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900 ${className}`}>
                <div className="p-8 text-center text-slate-400">
                    <Loader2 className="inline animate-spin mr-2" size={18} />
                    Cargando…
                </div>
            </div>
        );
    }

    if (workingRows.length === 0) {
        return (
            <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
                <EmptyState variant="no-results" title={emptyMessage} />
                {onAddRow && !readOnly && (
                    <div className="p-4 text-center border-t border-slate-100 dark:border-slate-800">
                        <button
                            onClick={onAddRow}
                            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                        >
                            <Plus size={16} /> {addRowLabel}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Compute grid template from columns
    const hasActions = !!onDeleteRow && !readOnly;
    const gridTemplate = [
        ...columns.map((c) => c.width ?? 'minmax(96px, 1fr)'),
        ...(hasActions ? ['44px'] : []),
    ].join(' ');

    return (
        <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
            <div className="overflow-x-auto rounded-2xl">
                <div
                    className="grid"
                    style={{ gridTemplateColumns: gridTemplate, minWidth: 'fit-content' }}
                >
                    {/* Header row */}
                    {columns.map((col, colIdx) => (
                        <div
                            key={`h-${col.key}`}
                            className={[
                                'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50',
                                'border-b border-slate-200 dark:border-slate-800',
                                'border-r border-slate-100 dark:border-slate-800 last:border-r-0',
                                'min-w-0 truncate',
                                alignClass(col),
                                colIdx === 0 ? 'sticky left-0 z-20 bg-slate-50 dark:bg-slate-800/50 shadow-[2px_0_4px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_4px_rgba(0,0,0,0.3)]' : '',
                            ].join(' ')}
                            title={col.header}
                        >
                            {col.header}
                        </div>
                    ))}

                    {/* Group + data rows */}
                    {groups.map((group) => (
                        <GroupRows
                            key={`g-${group.name || '_'}`}
                            group={group}
                            columns={columns}
                            rowKey={rowKey}
                            isEditable={isEditable}
                            handleLocalChange={handleLocalChange}
                            handleBlur={handleBlur}
                            cellState={cellState}
                            onDeleteRow={onDeleteRow}
                            readOnly={readOnly}
                            hasActions={hasActions}
                        />
                    ))}

                    {/* Totals footer */}
                    {totals && (
                        <>
                            {columns.map((col, idx) => {
                                const v = totals[col.key];
                                return (
                                    <div
                                        key={`t-${col.key}`}
                                        className={[
                                            'px-3 py-2 text-sm font-bold border-t-2 border-amber-400 bg-amber-50 dark:bg-amber-900/20',
                                            'border-r border-slate-100 dark:border-slate-800 last:border-r-0',
                                            'min-w-0 truncate',
                                            alignClass(col),
                                            col.type === 'readonly' ? 'text-slate-500 italic' : 'text-slate-900 dark:text-white',
                                            idx === 0 ? 'sticky left-0 z-10 bg-amber-50 dark:bg-amber-900/20 shadow-[2px_0_4px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_4px_rgba(0,0,0,0.3)]' : '',
                                        ].join(' ')}
                                    >
                                        {idx === 0 ? (typeof v === 'string' ? v : 'TOTAL') : ''}
                                        {idx > 0 && v !== undefined
                                            ? col.type === 'readonly'
                                                ? ''
                                                : formatCell(v, col)
                                            : ''}
                                    </div>
                                );
                            })}
                            {hasActions && (
                                <div className="border-t-2 border-amber-400 bg-amber-50 dark:bg-amber-900/20" />
                            )}
                        </>
                    )}
                </div>
            </div>

            {onAddRow && !readOnly && (
                <div className="p-3 text-center border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <button
                        onClick={onAddRow}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                    >
                        <Plus size={16} /> {addRowLabel}
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Sub-component: rows of one group ─────────────────────────────────

interface GroupRowsProps<T> {
    group: { name: string; rows: T[] };
    columns: Column<T>[];
    rowKey: (row: T) => string | number;
    isEditable: (col: Column<T>) => boolean;
    handleLocalChange: (rk: string | number, col: Column<T>, raw: string) => void;
    handleBlur: (rk: string | number, col: Column<T>) => void;
    cellState: Record<string, CellState>;
    onDeleteRow?: (rk: string | number) => void;
    readOnly: boolean;
}

function GroupRows<T>({
    group,
    columns,
    rowKey,
    isEditable,
    handleLocalChange,
    handleBlur,
    cellState,
    onDeleteRow,
    readOnly,
    hasActions,
    isRowDirty,
}: GroupRowsProps<T> & { isRowDirty?: (row: T) => boolean }) {
    return (
        <>
            {group.name && (
                <div
                    className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border-b border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800/50"
                    style={{ gridColumn: '1 / -1' }}
                >
                    ▾ {group.name}
                </div>
            )}
            {group.rows.map((row) => {
                const rk = rowKey(row);
                return (
                    <RowCells
                        key={String(rk)}
                        row={row}
                        rk={rk}
                        columns={columns}
                        isEditable={isEditable}
                        handleLocalChange={handleLocalChange}
                        handleBlur={handleBlur}
                        cellState={cellState}
                        onDeleteRow={onDeleteRow}
                        readOnly={readOnly}
                        isDirty={isRowDirty?.(row) ?? false}
                    />
                );
            })}
        </>
    );
}

interface RowCellsProps<T> {
    row: T;
    rk: string | number;
    columns: Column<T>[];
    isEditable: (col: Column<T>) => boolean;
    handleLocalChange: (rk: string | number, col: Column<T>, raw: string) => void;
    handleBlur: (rk: string | number, col: Column<T>) => void;
    cellState: Record<string, CellState>;
    onDeleteRow?: (rk: string | number) => void;
    readOnly: boolean;
    isDirty?: boolean;
}

function RowCells<T>({
    row,
    rk,
    columns,
    isEditable,
    handleLocalChange,
    handleBlur,
    cellState,
    onDeleteRow,
    readOnly,
    isDirty = false,
}: RowCellsProps<T>) {
    return (
        <>
            {columns.map((col, colIdx) => {
                const stateKey = `${rk}:${col.key}`;
                const state = cellState[stateKey];
                const value = getValue(row, col.key);
                const editable = isEditable(col);
                const isFirstCol = colIdx === 0;
                const baseClass = [
                    'px-2 py-1 text-sm border-b border-slate-100 dark:border-slate-800',
                    'border-r border-slate-100 dark:border-slate-800 last:border-r-0',
                    alignClass(col),
                    col.className ?? '',
                    state?.status === 'error' ? 'bg-rose-50 dark:bg-rose-900/20' : '',
                    // Primera columna sticky: nombre del trabajador siempre
                    // visible al hacer scroll horizontal. Fondo sólido para
                    // tapar el contenido que pasa por debajo al scrollear.
                    isFirstCol ? 'sticky left-0 z-10 bg-white dark:bg-slate-900 shadow-[2px_0_4px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_4px_rgba(0,0,0,0.3)]' : '',
                ].join(' ');

                // Custom renderer takes precedence
                if (col.render) {
                    return (
                        <div key={stateKey} className={[baseClass, 'min-w-0'].join(' ')}>
                            {col.render(value, row)}
                        </div>
                    );
                }

                // Read-only / display
                if (!editable) {
                    return (
                        <div key={stateKey} className={[baseClass, 'min-w-0', 'truncate', 'text-slate-700 dark:text-slate-300'].join(' ')} title={formatCell(value, col) || undefined}>
                            {col.type === 'currency' || col.type === 'number' || col.type === 'percent'
                                ? <span className="font-mono tabular-nums">{formatCell(value, col)}</span>
                                : <span>{formatCell(value, col)}</span>}
                        </div>
                    );
                }

                // Editable select
                if (col.type === 'select' && col.options) {
                    return (
                        <div key={stateKey} className={[baseClass, 'min-w-0'].join(' ')}>
                            <select
                                value={String(value ?? '')}
                                onChange={(e) => handleLocalChange(rk, col, e.target.value)}
                                onBlur={() => handleBlur(rk, col)}
                                className="w-full min-w-0 bg-transparent outline-none border-none focus:ring-2 focus:ring-indigo-500/30 rounded px-1 py-0.5 truncate"
                            >
                                <option value="">—</option>
                                {col.options.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            {state?.status === 'saving' && (
                                <Loader2 size={12} className="inline ml-1 animate-spin text-slate-400" />
                            )}
                            {state?.status === 'error' && (
                                <span title={state.error} className="inline-flex ml-1 text-rose-500">
                                    <AlertCircle size={12} />
                                </span>
                            )}
                        </div>
                    );
                }

                // Editable text/number/currency/percent/date
                const inputType =
                    col.type === 'date' ? 'date' :
                    col.type === 'number' || col.type === 'currency' || col.type === 'percent' ? 'text' : // use text for spain format
                    'text';
                const inputMode =
                    col.type === 'number' || col.type === 'currency' || col.type === 'percent' ? 'decimal' : undefined;

                return (
                    <div key={stateKey} className={[baseClass, 'min-w-0'].join(' ')}>
                        <input
                            type={inputType}
                            inputMode={inputMode as 'decimal' | undefined}
                            // Controlled: prevents re-mount on internal state change
                            // (saving/error) which would steal focus from the user.
                            value={formatCell(value, col)}
                            onChange={(e) => handleLocalChange(rk, col, e.target.value)}
                            onBlur={() => handleBlur(rk, col)}
                            onFocus={(e) => {
                                // UX Excel: seleccionar todo al entrar para reemplazo
                                // rápido. En text inputs es lo natural; en numéricos
                                // también ayuda a borrar y reescribir.
                                requestAnimationFrame(() => e.currentTarget.select());
                            }}
                            className={[
                                'w-full min-w-0 bg-transparent outline-none border-none focus:ring-2 focus:ring-indigo-500/30 rounded px-1 py-0.5',
                                col.type === 'number' || col.type === 'currency' || col.type === 'percent' ? 'font-mono tabular-nums text-right' : '',
                            ].join(' ')}
                            aria-invalid={state?.status === 'error' ? 'true' : 'false'}
                            title={state?.error ?? (formatCell(value, col) || undefined)}
                        />
                        {state?.status === 'saving' && (
                            <Loader2 size={12} className="inline ml-1 animate-spin text-slate-400" />
                        )}
                        {state?.status === 'error' && (
                            <span title={state.error} className="inline-flex ml-1 text-rose-500">
                                <AlertCircle size={12} />
                            </span>
                        )}
                    </div>
                );
            })}
            {onDeleteRow && !readOnly && (
                <div className="px-1 py-1 border-b border-slate-100 dark:border-slate-800 text-center flex items-center justify-center">
                    <button
                        onClick={() => onDeleteRow(rk)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        title="Eliminar fila"
                        aria-label="Eliminar fila"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )}
        </>
    );
}
