import { motion } from 'framer-motion';
import { Users, UserPlus, UserX, TrendingUp } from 'lucide-react';

interface FunnelStage {
    stage: string;
    count: number;
    percentage: number;
    color: string;
}

interface HiringFunnelWidgetProps {
    data: {
        available: boolean;
        reason: string;
        applicants: number | null;
        interviews: number | null;
        offers: number | null;
        hired: number;
        conversionRate: number | null;
        avgTimeToHire: number | null;
    };
}

export default function HiringFunnelWidget({ data }: HiringFunnelWidgetProps) {
    if (!data.available) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6"
            >
                <div className="flex items-center gap-2 mb-4">
                    <UserPlus size={20} className="text-slate-400" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Embudo de Contratación
                    </h3>
                </div>
                <div className="flex min-h-64 flex-col items-center justify-center text-center text-slate-400">
                    <UserX size={30} className="mb-3" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">Sin fuente de selección</p>
                    <p className="mt-2 max-w-xs text-sm">{data.reason}</p>
                    <p className="mt-4 text-xs">Altas reales de los últimos 30 días: <strong>{data.hired}</strong></p>
                </div>
            </motion.div>
        );
    }

    const stages: FunnelStage[] = [
        {
            stage: 'Candidatos',
            count: data.applicants ?? 0,
            percentage: 100,
            color: 'bg-blue-500',
        },
        {
            stage: 'Entrevistas',
            count: data.interviews ?? 0,
            percentage: (data.applicants ?? 0) > 0 ? Math.round(((data.interviews ?? 0) / (data.applicants ?? 1)) * 100) : 0,
            color: 'bg-purple-500',
        },
        {
            stage: 'Ofertas',
            count: data.offers ?? 0,
            percentage: (data.applicants ?? 0) > 0 ? Math.round(((data.offers ?? 0) / (data.applicants ?? 1)) * 100) : 0,
            color: 'bg-amber-500',
        },
        {
            stage: 'Contratados',
            count: data.hired,
            percentage: (data.applicants ?? 0) > 0 ? Math.round((data.hired / (data.applicants ?? 1)) * 100) : 0,
            color: 'bg-emerald-500',
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6"
        >
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <UserPlus size={20} className="text-slate-400" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Embudo de Contratación
                    </h3>
                </div>
            </div>

            {/* Funnel Visual */}
            <div className="space-y-3 mb-6">
                {stages.map((stage, index) => (
                    <motion.div
                        key={stage.stage}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="relative"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-24 text-sm text-slate-600 dark:text-slate-400">
                                {stage.stage}
                            </div>
                            <div className="flex-1 relative h-10">
                                {/* Background bar */}
                                <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800 rounded-lg" />
                                
                                {/* Filled bar */}
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${stage.percentage}%` }}
                                    transition={{ duration: 0.8, delay: index * 0.1 }}
                                    className={`absolute inset-y-0 left-0 ${stage.color} rounded-lg flex items-center justify-end pr-3`}
                                >
                                    <span className="text-white font-medium text-sm">
                                        {stage.count.toLocaleString()}
                                    </span>
                                </motion.div>
                            </div>
                            <div className="w-16 text-right text-sm text-slate-500">
                                {stage.percentage}%
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg">
                        <TrendingUp size={18} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Tasa de Conversión</div>
                        <div className="text-lg font-semibold text-slate-900 dark:text-white">
                            {data.conversionRate?.toFixed(1)}%
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <Users size={18} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Tiempo Promedio</div>
                        <div className="text-lg font-semibold text-slate-900 dark:text-white">
                            {data.avgTimeToHire} días
                        </div>
                    </div>
                </div>
            </div>

            {/* Drop-off indicators */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-500 mb-2">Tasa de abandono por etapa</div>
                <div className="flex gap-2">
                    {stages.slice(0, -1).map((stage, index) => {
                        const nextStage = stages[index + 1];
                        const dropOff = stage.count > 0 
                            ? Math.round(((stage.count - nextStage.count) / stage.count) * 100) 
                            : 0;
                        
                        return (
                            <div key={stage.stage} className="flex-1 text-center">
                                <div className="text-xs text-slate-400">{stage.stage} →</div>
                                <div className="text-sm font-medium text-red-500">
                                    -{dropOff}%
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </motion.div>
    );
}
