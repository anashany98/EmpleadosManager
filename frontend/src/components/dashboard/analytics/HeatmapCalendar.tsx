import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';

interface HeatmapCalendarProps {
    data: Array<{ date: string; count: number; level: number }>;
    title?: string;
}

// Niveles de color para el heatmap
const LEVEL_COLORS = [
    'bg-slate-100 dark:bg-slate-800', // 0 - sin actividad
    'bg-emerald-200 dark:bg-emerald-900', // 1 - baja
    'bg-emerald-400 dark:bg-emerald-700', // 2 - media-baja
    'bg-emerald-500 dark:bg-emerald-500', // 3 - media
    'bg-emerald-600 dark:bg-emerald-400', // 4 - alta
    'bg-emerald-700 dark:bg-emerald-300', // 5 - muy alta
];

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function HeatmapCalendar({ data, title = 'Mapa de Actividad' }: HeatmapCalendarProps) {
    // Agrupar datos por semana para el calendario
    const getWeeksArray = () => {
        if (!data || data.length === 0) return [];
        
        // Crear un mapa de fechas para acceso rápido
        const dataMap = new Map<string, typeof data[0]>();
        data.forEach(item => {
            dataMap.set(item.date, item);
        });

        // Obtener rango de fechas (últimos 365 días)
        const today = new Date();
        const startDate = new Date(today);
        startDate.setFullYear(startDate.getFullYear() - 1);

        // Ajustar al domingo más cercano
        while (startDate.getDay() !== 0) {
            startDate.setDate(startDate.getDate() - 1);
        }

        const weeks: Array<Array<{ date: string; count: number; level: number }>> = [];
        let currentWeek: Array<{ date: string; count: number; level: number }> = [];
        let currentDate = new Date(startDate);

        while (currentDate <= today) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayData = dataMap.get(dateStr) || { date: dateStr, count: 0, level: 0 };
            currentWeek.push(dayData);

            if (currentDate.getDay() === 6) {
                weeks.push(currentWeek);
                currentWeek = [];
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        if (currentWeek.length > 0) {
            weeks.push(currentWeek);
        }

        return weeks;
    };

    const weeks = getWeeksArray();

    // Obtener etiquetas de meses
    const getMonthLabels = () => {
        if (weeks.length === 0) return [];
        
        const labels: Array<{ month: string; weekIndex: number }> = [];
        let lastMonth = -1;

        weeks.forEach((week, index) => {
            if (week.length > 0) {
                const firstDayOfWeek = new Date(week[0].date);
                const month = firstDayOfWeek.getMonth();
                if (month !== lastMonth) {
                    labels.push({ month: MONTHS[month], weekIndex: index });
                    lastMonth = month;
                }
            }
        });

        return labels;
    };

    const monthLabels = getMonthLabels();

    if (!data || data.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6"
            >
                <div className="flex items-center gap-2 mb-4">
                    <Calendar size={20} className="text-slate-400" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {title}
                    </h3>
                </div>
                <div className="h-40 flex items-center justify-center text-slate-400">
                    No hay datos disponibles
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Calendar size={20} className="text-slate-400" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {title}
                    </h3>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                    <span>Menos</span>
                    {LEVEL_COLORS.map((color, i) => (
                        <div
                            key={i}
                            className={`w-3 h-3 rounded-sm ${color}`}
                        />
                    ))}
                    <span>Más</span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="inline-flex flex-col min-w-max">
                    {/* Etiquetas de meses */}
                    <div className="flex mb-1 ml-8">
                        {monthLabels.map((label, i) => (
                            <span
                                key={i}
                                className="text-xs text-slate-500"
                                style={{
                                    position: 'relative',
                                    left: `${(label.weekIndex - (monthLabels[i - 1]?.weekIndex ?? -1) - 1) * 14}px`
                                }}
                            >
                                {label.month}
                            </span>
                        ))}
                    </div>

                    <div className="flex">
                        {/* Etiquetas de días */}
                        <div className="flex flex-col gap-[2px] mr-2 text-xs text-slate-500">
                            {DAYS.map((day, i) => (
                                <div key={i} className="h-3 flex items-center">
                                    {i % 2 === 1 ? day : ''}
                                </div>
                            ))}
                        </div>

                        {/* Grid del heatmap */}
                        <div className="flex gap-[2px]">
                            {weeks.map((week, weekIndex) => (
                                <div key={weekIndex} className="flex flex-col gap-[2px]">
                                    {week.map((day, dayIndex) => (
                                        <div
                                            key={`${weekIndex}-${dayIndex}`}
                                            className={`w-3 h-3 rounded-sm ${LEVEL_COLORS[day.level]} cursor-pointer hover:ring-2 hover:ring-slate-400 transition-all`}
                                            title={`${day.date}: ${day.count} eventos`}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Leyenda de estadísticas */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 text-sm">
                <div>
                    <span className="text-slate-500">Total eventos: </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                        {data.reduce((sum, d) => sum + d.count, 0).toLocaleString()}
                    </span>
                </div>
                <div>
                    <span className="text-slate-500">Días activos: </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                        {data.filter(d => d.count > 0).length}
                    </span>
                </div>
                <div>
                    <span className="text-slate-500">Promedio diario: </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                        {(data.reduce((sum, d) => sum + d.count, 0) / data.length).toFixed(1)}
                    </span>
                </div>
            </div>
        </motion.div>
    );
}