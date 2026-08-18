import { useState } from 'react';

interface CellInputProps {
    recordId: string;
    field: string;
    /** Valor actual formateado para mostrar (proviene del registro). */
    display: string;
    /** Convierte el texto tecleado al valor que se guarda. */
    parse: (raw: string) => unknown;
    onBlur: (recordId: string, field: string, value: unknown) => void;
    disabled?: boolean;
    type?: string;
    step?: string;
    title?: string;
    placeholder?: string;
    className?: string;
}

/**
 * Input de celda con borrador local. Mientras se escribe muestra lo que el
 * usuario teclea; al perder el foco guarda y vuelve a mostrar el valor del
 * registro, que el servidor recalcula en cada cambio (BRUTO, % disponible,
 * horas, diferencia...). Sustituye a `defaultValue`, que no se refrescaba
 * tras cada guardado ni al restaurar un cálculo automático.
 *
 * Al enfocar selecciona todo el contenido: así escribir reemplaza el valor
 * completo en lugar de añadir dígitos a los decimales existentes.
 */
export default function CellInput({ recordId, field, display, parse, onBlur, ...props }: CellInputProps) {
    const [draft, setDraft] = useState<string | null>(null);

    return (
        <input
            {...props}
            value={draft ?? display}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={() => {
                if (draft !== null) {
                    onBlur(recordId, field, parse(draft));
                    setDraft(null);
                }
            }}
        />
    );
}

/** Convierte un texto a número tolerando coma decimal, espacios y vacío. */
export function parseNumber(raw: string): number {
    const parsed = Number(raw.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
}

/** Formatea un importe/horas con un número fijo de decimales (2 por defecto). */
export function formatAmount(value: unknown, decimals = 2): string {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed.toFixed(decimals) : (0).toFixed(decimals);
}

/** Formatea un ratio (0.0635) como porcentaje con 2 decimales para mostrar. */
export function formatPercent(value: unknown): string {
    return (Math.round(Number(value || 0) * 10000) / 100).toString();
}

/** TGSS fijo para todos los empleados (6,35%), misma fuente que el backend. */
export const DEFAULT_TGSS_PERCENT = 6.35;

/** % Disponible = 100 − IRPF % − TGSS % (6,35% fijo), nunca por debajo de 0. */
export function availablePercentage(irpfRatio: unknown): number {
    return Math.max(100 - Number(irpfRatio || 0) * 100 - DEFAULT_TGSS_PERCENT, 0);
}

// ─── Fórmulas del control de gestoría (misma semántica que el backend) ───
// Replican `calculateRecordState` para que la rejilla muestre SIEMPRE el
// resultado calculado (importe / % disponible → BRUTO; BRUTO − productividad
// → Horas), incluso en registros antiguos o recién creados cuyo valor
// almacenado aún no se recalculó. Las sobrescrituras manuales se respetan.

/** Registro de control mensual con los campos que usan las fórmulas. */
type ControlRecordLite = Record<string, unknown>;

function round(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Total Importe = tarifa extra × horas extra + tarifa festiva × horas festivas. */
export function totalImporteOf(record: ControlRecordLite): number {
    return round(
        Number(record.overtimeRate || 0) * Number(record.overtimeHours || 0)
        + Number(record.holidayOvertimeRate || 0) * Number(record.holidayOvertimeHours || 0),
        2
    );
}

/** % Disponible efectivo (ratio, 4 decimales) = 100 − IRPF − TGSS. */
export function availableRatioOf(record: ControlRecordLite): number {
    return round(availablePercentage(Number(record.irpf || 0)) / 100, 4);
}

/** BRUTO = Total Importe / % Disponible. Respeta la sobrescritura manual. */
export function brutoOf(record: ControlRecordLite): number {
    if (record.isGrossManual) return Number(record.gross || 0);
    const pct = availableRatioOf(record);
    if (pct <= 0) return 0;
    return round(totalImporteOf(record) / pct, 2);
}

/** Productividad = Var. Positiva / BRUTO (ratio, 4 decimales). Respeta la manual. */
export function productividadOf(record: ControlRecordLite, bruto = brutoOf(record)): number {
    if (record.isProductivityManual) return Number(record.productivity || 0);
    if (bruto <= 0) return 0;
    return round(Number(record.positiveVariable || 0) / bruto, 4);
}

/** Horas = BRUTO − Productividad. Respeta la sobrescritura manual. */
export function horasOf(record: ControlRecordLite): number {
    if (record.isHoursAmountManual) return Number(record.hoursAmount || 0);
    const bruto = brutoOf(record);
    return round(bruto - productividadOf(record, bruto), 2);
}

/** Diferencia = BRUTO − Total Importe. Respeta la sobrescritura manual. */
export function diferenciaOf(record: ControlRecordLite): number {
    if (record.isDifferenceManual) return Number(record.difference || 0);
    return round(brutoOf(record) - totalImporteOf(record), 2);
}
