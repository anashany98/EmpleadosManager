import {
    AlertTriangle,
    Briefcase,
    Building2,
    Calendar,
    Clock,
    GraduationCap,
    LineChart,
    Stethoscope,
    TrendingUp,
    Users
} from 'lucide-react';

export type ReportType = 'ATTENDANCE' | 'OVERTIME' | 'VACATIONS' | 'COSTS' | 'ABSENCES_DETAILED' | 'KPIS' | 'GENDER_GAP' | 'OBRA_SUMMARY' | 'OBRA_EMPLOYEES' | 'PRL_MEDICAL' | 'PRL_TRAINING';
export type ReportTone = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';

/**
 * Categorías que agrupan los reports en la barra lateral. El orden
 * del array es el orden en que se renderizan las secciones.
 */
export type ReportCategory = 'ATTENDANCE' | 'TIME' | 'COSTS' | 'OBRAS' | 'PRL';

export interface ReportCategoryDefinition {
    id: ReportCategory;
    label: string;
    description: string;
}

export const reportCategories: ReportCategoryDefinition[] = [
    { id: 'ATTENDANCE', label: 'Asistencia',    description: 'Jornadas, horas extra y marcas de los empleados.' },
    { id: 'TIME',       label: 'Tiempo',        description: 'Vacaciones, bajas, permisos y demás ausencias.' },
    { id: 'COSTS',      label: 'Costes y org.', description: 'Nóminas, KPIs globales y brecha de género.' },
    { id: 'OBRAS',      label: 'Obras',         description: 'Resumen de horas y gastos por proyecto.' },
    { id: 'PRL',        label: 'PRL',           description: 'Prevención de riesgos: médicas y formación.' }
];

export function getReportCategory(category: ReportCategory): ReportCategoryDefinition {
    return reportCategories.find((c) => c.id === category) || reportCategories[0];
}

export interface CompanyOption {
    id: string;
    name: string;
}

export interface DepartmentOptionsResponse {
    departments?: string[];
}

export interface SummaryCardData {
    label: string;
    value: string;
    helper: string;
    tone: ReportTone;
}

export interface ReportDefinition {
    id: ReportType;
    name: string;
    description: string;
    tone: ReportTone;
    endpoint: string;
    icon: typeof Clock;
    category: ReportCategory;
}

export const reportsCatalog: ReportDefinition[] = [
    {
        id: 'ATTENDANCE',
        name: 'Asistencia y jornadas',
        description: 'Resumen diario con horas trabajadas, segmentos y jornadas incompletas.',
        tone: 'blue',
        endpoint: '/reports/attendance-summary',
        icon: Clock,
        category: 'ATTENDANCE'
    },
    {
        id: 'OVERTIME',
        name: 'Horas extra y coste',
        description: 'Horas adicionales, tarifas aplicadas y coste generado por periodo.',
        tone: 'emerald',
        endpoint: '/reports/overtime',
        icon: TrendingUp,
        category: 'ATTENDANCE'
    },
    {
        id: 'VACATIONS',
        name: 'Vacaciones y saldos',
        description: 'Cuota anual, consumo, peticiones registradas y riesgo de agotamiento.',
        tone: 'amber',
        endpoint: '/reports/vacations',
        icon: Calendar,
        category: 'TIME'
    },
    {
        id: 'ABSENCES_DETAILED',
        name: 'Bajas y ausencias',
        description: 'Casos detallados con duración, motivo y seguimiento por empleado.',
        tone: 'rose',
        endpoint: '/reports/absences-detailed',
        icon: AlertTriangle,
        category: 'TIME'
    },
    {
        id: 'COSTS',
        name: 'Coste empresa',
        description: 'Bruto, seguridad social, IRPF y coste total por persona o departamento.',
        tone: 'violet',
        endpoint: '/reports/costs',
        icon: Building2,
        category: 'COSTS'
    },
    {
        id: 'KPIS',
        name: 'KPIs de organización',
        description: 'Rotación, absentismo y foco departamental para dirección y RRHH.',
        tone: 'blue',
        endpoint: '/reports/kpis',
        icon: LineChart,
        category: 'COSTS'
    },
    {
        id: 'GENDER_GAP',
        name: 'Igualdad y diversidad',
        description: 'Plantilla, medias salariales y brecha estimada por departamento.',
        tone: 'rose',
        endpoint: '/reports/gender-gap',
        icon: Users,
        category: 'COSTS'
    },
    {
        id: 'OBRA_SUMMARY',
        name: 'Resumen por obra',
        description: 'Horas imputadas, gastos por tipo y consumo de presupuesto por obra.',
        tone: 'blue',
        endpoint: '/reports/obras',
        icon: Briefcase,
        category: 'OBRAS'
    },
    {
        id: 'OBRA_EMPLOYEES',
        name: 'Gastos de obra por empleado',
        description: 'Horas y gastos (dietas, hospedaje, vuelo, transporte) imputados por empleado dentro de cada obra.',
        tone: 'emerald',
        endpoint: '/reports/obras/employees',
        icon: Briefcase,
        category: 'OBRAS'
    },
    {
        id: 'PRL_MEDICAL',
        name: 'Revisiones médicas (PRL)',
        description: 'Histórico de reconocimientos médicos, declinaciones, próximas revisiones y caducidades.',
        tone: 'rose',
        endpoint: '/reports/prl/medical-reviews',
        icon: Stethoscope,
        category: 'PRL'
    },
    {
        id: 'PRL_TRAINING',
        name: 'Cursos y formación',
        description: 'Cursos realizados, horas impartidas, distribución por tipo y ranking de cursos.',
        tone: 'violet',
        endpoint: '/reports/prl/trainings',
        icon: GraduationCap,
        category: 'PRL'
    }
];

export function getReportDefinition(type: ReportType) {
    return reportsCatalog.find((report) => report.id === type) || reportsCatalog[0];
}

export function getToneClasses(tone: ReportTone) {
    if (tone === 'emerald') {
        return {
            border: 'border-emerald-200 dark:border-emerald-500/20',
            soft: 'bg-emerald-50 dark:bg-emerald-500/10',
            text: 'text-emerald-600 dark:text-emerald-300'
        };
    }

    if (tone === 'amber') {
        return {
            border: 'border-amber-200 dark:border-amber-500/20',
            soft: 'bg-amber-50 dark:bg-amber-500/10',
            text: 'text-amber-600 dark:text-amber-300'
        };
    }

    if (tone === 'rose') {
        return {
            border: 'border-rose-200 dark:border-rose-500/20',
            soft: 'bg-rose-50 dark:bg-rose-500/10',
            text: 'text-rose-600 dark:text-rose-300'
        };
    }

    if (tone === 'violet') {
        return {
            border: 'border-violet-200 dark:border-violet-500/20',
            soft: 'bg-violet-50 dark:bg-violet-500/10',
            text: 'text-violet-600 dark:text-violet-300'
        };
    }

    return {
        border: 'border-blue-200 dark:border-blue-500/20',
        soft: 'bg-blue-50 dark:bg-blue-500/10',
        text: 'text-blue-600 dark:text-blue-300'
    };
}
