import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface KPICardProps {
    title: string;
    value: number | string;
    previousValue?: number;
    trend?: number;
    trendDirection?: 'up' | 'down' | 'stable';
    unit?: string;
    icon: LucideIcon;
    color?: 'blue' | 'green' | 'amber' | 'rose' | 'purple' | 'emerald' | 'red' | 'cyan';
    description?: string;
    isPositiveTrend?: boolean; // Whether up is good (e.g., headcount up is good, turnover up is bad)
    change?: number;
    changeType?: 'positive' | 'negative' | 'neutral';
}

const colorStyles = {
    blue: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        icon: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
        trend: 'text-blue-600 dark:text-blue-400'
    },
    green: {
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        icon: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
        trend: 'text-emerald-600 dark:text-emerald-400'
    },
    emerald: {
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        icon: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
        trend: 'text-emerald-600 dark:text-emerald-400'
    },
    amber: {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        icon: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
        trend: 'text-amber-600 dark:text-amber-400'
    },
    rose: {
        bg: 'bg-rose-50 dark:bg-rose-900/20',
        icon: 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400',
        trend: 'text-rose-600 dark:text-rose-400'
    },
    red: {
        bg: 'bg-red-50 dark:bg-red-900/20',
        icon: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
        trend: 'text-red-600 dark:text-red-400'
    },
    purple: {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        icon: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
        trend: 'text-purple-600 dark:text-purple-400'
    },
    cyan: {
        bg: 'bg-cyan-50 dark:bg-cyan-900/20',
        icon: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400',
        trend: 'text-cyan-600 dark:text-cyan-400'
    }
};

export default function KPICard({
    title,
    value,
    trend,
    trendDirection = 'stable',
    unit = '',
    icon: Icon,
    color = 'blue',
    description,
    isPositiveTrend = true,
    change,
    changeType
}: KPICardProps) {
    const styles = colorStyles[color] || colorStyles.blue;
    
    // Determine trend direction from change if provided
    const effectiveTrendDirection = change !== undefined 
        ? (change > 0 ? 'up' : change < 0 ? 'down' : 'stable')
        : trendDirection;
    
    const effectiveTrend = change !== undefined ? Math.abs(change) : trend;

    const getTrendIcon = () => {
        if (effectiveTrendDirection === 'up') return TrendingUp;
        if (effectiveTrendDirection === 'down') return TrendingDown;
        return Minus;
    };

    const TrendIcon = getTrendIcon();

    // Determine if the trend is positive for the context
    const isGoodTrend = changeType !== undefined 
        ? changeType === 'positive'
        : (isPositiveTrend && effectiveTrendDirection === 'up') || 
          (!isPositiveTrend && effectiveTrendDirection === 'down');

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            className={`${styles.bg} rounded-2xl p-5 border border-slate-100 dark:border-slate-800 transition-shadow hover:shadow-lg`}
        >
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-xl ${styles.icon}`}>
                    <Icon size={20} />
                </div>
                {effectiveTrend !== undefined && effectiveTrend !== 0 && (
                    <div className={`flex items-center gap-1 text-sm ${
                        isGoodTrend ? 'text-emerald-500' : 'text-red-500'
                    }`}>
                        <TrendIcon size={14} />
                        <span>{effectiveTrend.toFixed(1)}%</span>
                    </div>
                )}
            </div>
            
            <div className="space-y-1">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {title}
                </h3>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">
                        {value}
                    </span>
                    {unit && (
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                            {unit}
                        </span>
                    )}
                </div>
                {description && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                        {description}
                    </p>
                )}
            </div>
        </motion.div>
    );
}