import { AlertTriangle, Shield, Briefcase, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AlertsWidgetProps {
    metrics?: any;
}

interface Alert {
    type: string;
    count: number;
    description: string;
}

export function AlertsWidget({ metrics }: AlertsWidgetProps) {
    const alerts: Alert[] = [];

    if (metrics?.contracts?.dniExpiring > 0) {
        alerts.push({
            type: 'CONTRACT',
            count: metrics.contracts.dniExpiring,
            description: 'DNI por renovar'
        });
    }

    if (metrics?.contracts?.licenseExpiring > 0) {
        alerts.push({
            type: 'LICENSE',
            count: metrics.contracts.licenseExpiring,
            description: 'Licencias por vencer'
        });
    }

    if (metrics?.contracts?.medicalReviewExpiring > 0) {
        alerts.push({
            type: 'MEDICAL',
            count: metrics.contracts.medicalReviewExpiring,
            description: 'Reconocimientos médicos'
        });
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'CONTRACT': return <Briefcase size={16} />;
            case 'LICENSE': return <Shield size={16} />;
            case 'MEDICAL': return <FileText size={16} />;
            default: return <AlertTriangle size={16} />;
        }
    };

    const getColor = (type: string) => {
        switch (type) {
            case 'CONTRACT': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
            case 'LICENSE': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20';
            case 'MEDICAL': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
            default: return 'text-slate-600 bg-slate-50';
        }
    };

    return (
        <div className="p-4">
            <div className="flex items-center gap-2 mb-3 text-amber-600">
                <AlertTriangle size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">Alertas</span>
            </div>

            {alerts.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-600 text-sm">
                    <Shield size={16} />
                    <span>Todo al día</span>
                </div>
            ) : (
                <div className="space-y-2">
                    {alerts.map((alert) => (
                        <Link
                            key={alert.type}
                            to="/employees"
                            className={`flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${getColor(alert.type)}`}
                        >
                            <div className="shrink-0">
                                {getIcon(alert.type)}
                            </div>
                            <div className="flex-1">
                                <div className="font-medium text-sm">
                                    {alert.count} {alert.description}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {alerts.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <span className="text-xs text-slate-500">
                        Requiere acción
                    </span>
                </div>
            )}
        </div>
    );
}