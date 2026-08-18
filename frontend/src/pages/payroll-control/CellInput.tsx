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
 */
export default function CellInput({ recordId, field, display, parse, onBlur, ...props }: CellInputProps) {
    const [draft, setDraft] = useState<string | null>(null);

    return (
        <input
            {...props}
            value={draft ?? display}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
                if (draft !== null) {
                    onBlur(recordId, field, parse(draft));
                    setDraft(null);
                }
            }}
        />
    );
}

/** Formatea un ratio (0.0635) como porcentaje con 2 decimales para mostrar. */
export function formatPercent(value: unknown): string {
    return (Math.round(Number(value || 0) * 10000) / 100).toString();
}
