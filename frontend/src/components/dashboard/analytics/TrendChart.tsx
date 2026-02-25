import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';

interface TrendChartProps {
    data: Array<{ date?: string; month?: string; [key: string]: number | string | undefined }>;
    title: string;
    dataKey?: string;
    color?: string;
    lines?: Array<{
        dataKey: string;
        name: string;
        color: string;
    }>;
    height?: number;
}

const monthNames: Record<string, string> = {
    '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
    '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
    '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic'
};

export default function TrendChart({ 
    data, 
    title, 
    dataKey,
    color = '#3b82f6',
    lines,
    height = 300 
}: TrendChartProps) {
    const formattedData = data.map(item => {
        // Handle both 'date' and 'month' properties
        const dateStr = item.date || item.month || '';
        const [year, month] = dateStr.toString().split('-');
        return {
            ...item,
            label: monthNames[month] || month || dateStr
        };
    });

    // If lines not provided, create a single line from dataKey
    const chartLines = lines || (dataKey ? [{
        dataKey,
        name: title,
        color
    }] : []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6"
        >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                {title}
            </h3>
            
            {formattedData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-400">
                    No hay datos disponibles
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    <LineChart data={formattedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid 
                            strokeDasharray="3 3" 
                            stroke="#e2e8f0" 
                            strokeOpacity={0.5}
                        />
                        <XAxis 
                            dataKey="label" 
                            tick={{ fontSize: 12, fill: '#64748b' }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={false}
                        />
                        <YAxis 
                            tick={{ fontSize: 12, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip 
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                        />
                        <Legend />
                        {chartLines.map((line) => (
                            <Line
                                key={line.dataKey}
                                type="monotone"
                                dataKey={line.dataKey}
                                name={line.name}
                                stroke={line.color}
                                strokeWidth={2}
                                dot={{ fill: line.color, strokeWidth: 0, r: 4 }}
                                activeDot={{ r: 6, strokeWidth: 2, stroke: line.color }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            )}
        </motion.div>
    );
}