import { ShieldCheck, Scale, Info } from 'lucide-react';

export const LegalFooter = () => {
    return (
        <footer className="mt-32 py-12 px-4 border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs font-medium">
                    <ShieldCheck size={14} />
                    <span>Cumplimiento RGPD & LOPDGDD 2026</span>
                </div>

                <div className="flex items-center gap-6">
                    <a href="javascript:void(0)" className="flex items-center gap-1.5 text-slate-500 hover:text-blue-500 dark:text-slate-400 dark:hover:text-blue-400 text-xs font-semibold transition-colors">
                        <Scale size={14} />
                        Política de Privacidad
                    </a>
                    <a href="javascript:void(0)" className="flex items-center gap-1.5 text-slate-500 hover:text-blue-500 dark:text-slate-400 dark:hover:text-blue-400 text-xs font-semibold transition-colors">
                        <Info size={14} />
                        Aviso Legal
                    </a>
                    <a href="javascript:void(0)" className="flex items-center gap-1.5 text-slate-500 hover:text-blue-500 dark:text-slate-400 dark:hover:text-blue-400 text-xs font-semibold transition-colors">
                        <ShieldCheck size={14} />
                        Ejercicio de Derechos
                    </a>
                </div>

                <div className="text-slate-400 dark:text-slate-600 text-[10px] uppercase tracking-widest font-bold">
                    v1.2.0-secure
                </div>
            </div>
        </footer>
    );
};
