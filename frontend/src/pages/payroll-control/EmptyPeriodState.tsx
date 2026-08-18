import { CalendarDays, CheckCircle2, Loader2 } from 'lucide-react';
import { MONTHS } from './types';

interface EmptyPeriodStateProps {
    month: number;
    year: number;
    creatingPeriod: boolean;
    isGlobalAdmin: boolean;
    selectedCompanyId: string;
    onCreatePeriod: () => void;
}

export default function EmptyPeriodState({
    month, year, creatingPeriod, isGlobalAdmin, selectedCompanyId, onCreatePeriod
}: EmptyPeriodStateProps) {
    return (
        <section className="rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 px-6 py-10 text-center dark:border-blue-800 dark:bg-blue-950/20">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-700 text-white">
                <CalendarDays size={22} />
            </div>
            <h2 className="mt-4 text-lg font-extrabold text-slate-950 dark:text-white">
                {MONTHS[month - 1]} {year} todavía no está asignado
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                La consulta no crea datos automáticamente. Confirma la creación para asignar ahora los empleados activos y congelar su categoría, código de gestoría y datos mensuales iniciales.
            </p>
            <button
                type="button"
                onClick={onCreatePeriod}
                disabled={creatingPeriod || (isGlobalAdmin && !selectedCompanyId)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {creatingPeriod ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Crear período y asignar empleados
            </button>
        </section>
    );
}
