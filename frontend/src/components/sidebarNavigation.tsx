import {
    AlertTriangle,
    BarChart3,
    Building2,
    Calendar as CalendarIcon,
    Clock,
    DollarSign,
    FileSpreadsheet,
    FileText,
    History,
    Inbox,
    LayoutDashboard,
    Network,
    Package,
    Plane,
    Settings,
    Shield,
    Target,
    User,
    Users
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { AppFeatureKey } from '@shared/authz';

export interface NavItem {
    path: string;
    label: string;
    icon: ReactNode;
    feature: AppFeatureKey;
}

export interface NavCategory {
    id: string;
    label: string;
    icon: ReactNode;
    items: NavItem[];
}

export const navCategories: NavCategory[] = [
    {
        id: 'personal',
        label: 'Personal',
        icon: <User size={16} />,
        items: [
            { path: '/my-documents', label: 'Mis Documentos', icon: <FileText size={18} />, feature: 'myDocuments' },
            { path: '/profile', label: 'Mi Perfil', icon: <Users size={18} />, feature: 'profileSelf' },
            { path: '/vacations', label: 'Vacaciones', icon: <Plane size={18} />, feature: 'vacationsPortal' },
            { path: '/expenses', label: 'Gastos', icon: <DollarSign size={18} />, feature: 'expensesPortal' }
        ]
    },
    {
        id: 'management',
        label: 'Gestion',
        icon: <LayoutDashboard size={16} />,
        items: [
            { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} />, feature: 'dashboard' },
            { path: '/employees', label: 'Empleados', icon: <Users size={18} />, feature: 'employees' },
            { path: '/employees/org-chart', label: 'Organigrama', icon: <Network size={18} />, feature: 'orgChart' },
            { path: '/companies', label: 'Empresas', icon: <Building2 size={18} />, feature: 'companies' }
        ]
    },
    {
        id: 'time',
        label: 'Tiempo y Asistencia',
        icon: <Clock size={16} />,
        items: [
            { path: '/calendar', label: 'Calendario', icon: <CalendarIcon size={18} />, feature: 'calendar' },
            { path: '/timesheet', label: 'Fichajes', icon: <Clock size={18} />, feature: 'timesheetManagement' },
            { path: '/anomalies', label: 'Anomalias', icon: <AlertTriangle size={18} />, feature: 'anomalies' }
        ]
    },
    {
        id: 'operations',
        label: 'Operaciones',
        icon: <Package size={16} />,
        items: [
            { path: '/assets', label: 'Inventario', icon: <Package size={18} />, feature: 'assets' },
            { path: '/inbox', label: 'Bandeja de Entrada', icon: <Inbox size={18} />, feature: 'inbox' }
        ]
    },
    {
        id: 'admin',
        label: 'Administracion',
        icon: <Shield size={16} />,
        items: [
            { path: '/analytics', label: 'Analytics', icon: <BarChart3 size={18} />, feature: 'analytics' },
            { path: '/performance', label: 'Desempeno', icon: <Target size={18} />, feature: 'performance' },
            { path: '/audit', label: 'Auditoria', icon: <History size={18} />, feature: 'audit' },
            { path: '/reports', label: 'Reportes', icon: <FileText size={18} />, feature: 'reports' },
            { path: '/import', label: 'Importar Nomina', icon: <FileSpreadsheet size={18} />, feature: 'payrollImport' },
            { path: '/users', label: 'Usuarios', icon: <Shield size={18} />, feature: 'users' },
            { path: '/settings', label: 'Configuracion', icon: <Settings size={18} />, feature: 'settings' }
        ]
    }
];

export const navItems: NavItem[] = navCategories.flatMap((category) => category.items);
