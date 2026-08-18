import type { GrandTotals } from './types';

interface MonthlyTotalsBarProps {
    visibleCount: number;
    missingCodes: number;
    manualOverrides: number;
    grandTotals: GrandTotals;
    savingState: 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR';
}

export default function MonthlyTotalsBar({
    visibleCount, missingCodes, manualOverrides, grandTotals, savingState
}: MonthlyTotalsBarProps) {
    return (
        <div className="sticky bottom-0 z-30 grid shrink-0 grid-cols-2 gap-px border-t border-slate-700 bg-slate-700 text-white sm:grid-cols-3 xl:grid-cols-7" aria-label="Resumen de cierre mensual">
            <div className="bg-slate-950 px-4 py-2.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Trabajadores visibles</span>
                <strong className="text-base">{visibleCount}</strong>
            </div>
            <div className="bg-slate-950 px-4 py-2.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Incidencias código</span>
                <strong className={missingCodes ? 'text-rose-300' : 'text-emerald-300'}>{missingCodes}</strong>
            </div>
            <div className="bg-slate-950 px-4 py-2.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Correcciones manuales</span>
                <strong className={manualOverrides ? 'text-amber-300' : 'text-emerald-300'}>{manualOverrides}</strong>
            </div>
            <div className="bg-slate-950 px-4 py-2.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Horas extra</span>
                <strong>{grandTotals.overtimeAmount.toFixed(2)} €</strong>
            </div>
            <div className="bg-slate-950 px-4 py-2.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Horas trabajadas</span>
                <strong>{grandTotals.trabajadas.toFixed(2)} h</strong>
            </div>
            <div className="bg-slate-950 px-4 py-2.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Dietas</span>
                <strong>{grandTotals.diets.toFixed(2)} €</strong>
            </div>
            <div className="flex items-center justify-between gap-3 bg-slate-950 px-4 py-2.5">
                <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Bruto efectivo</span>
                    <strong className="text-lg">{grandTotals.gross.toFixed(2)} €</strong>
                </div>
                <span className={`h-2.5 w-2.5 rounded-full ${savingState === 'ERROR' ? 'bg-rose-400' : savingState === 'SAVING' ? 'animate-pulse bg-amber-300' : 'bg-emerald-400'}`} title={savingState === 'ERROR' ? 'Error al guardar' : savingState === 'SAVING' ? 'Guardando' : 'Guardado'} />
            </div>
        </div>
    );
}
