import {
    BarChart3,
    Calendar as CalendarIcon,
    Building2,
    Briefcase,
    FileText,
    TrendingUp,
    ClipboardList,
    User,
    Users,
    Home,
    Inbox,
    Settings,
    UserPlus,
    LayoutDashboard,
    Activity,
 Monitor
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
        id: 'dashboard',
        label: 'Dashboard',
        icon: <Home size={20} />,
        items: [
            { path: '/', label: 'Dashboard', icon: <Home size={18} />, feature: 'dashboard' },
            { path: '/analytics', label: 'Analytics', icon: <TrendingUp size={18} />, feature: 'analytics' },
            { path: '/performance', label: 'Performance', icon: <Activity size={18} />, feature: 'performance' }
        ]
    },
    {
        id: 'empleados',
        label: 'Empleados',
        icon: <Users size={20} />,
        items: [
            { path: '/employees', label: 'Empleados', icon: <Users size={18} />, feature: 'employees' },
            { path: '/employees/org-chart', label: 'Organigrama', icon: <Building2 size={18} />, feature: 'orgChart' },
            { path: '/profile', label: 'Mi Perfil', icon: <User size={18} />, feature: 'profileSelf' }
        ]
    },
    {
        id: 'tiempo',
        label: 'Tiempo',
        icon: <CalendarIcon size={20} />,
        items: [
            { path: '/calendar', label: 'Calendario', icon: <CalendarIcon size={18} />, feature: 'calendar' },
            { path: '/vacations', label: 'Vacaciones', icon: <BarChart3 size={18} />, feature: 'vacationsPortal' }
        ]
    },
    {
        id: 'companies',
        label: 'Empresas',
        icon: <Building2 size={20} />,
        items: [
            { path: '/companies', label: 'Empresas', icon: <Building2 size={18} />, feature: 'companies' }
        ]
    },
    {
        id: 'recursos',
        label: 'Recursos',
        icon: <Briefcase size={20} />,
        items: [
            { path: '/assets', label: 'Activos', icon: <Briefcase size={18} />, feature: 'assets' },
            { path: '/import', label: 'Importar Nóminas', icon: <FileText size={18} />, feature: 'payrollImport' }
        ]
    },
    {
        id: 'admin',
        label: 'Admin',
        icon: <Settings size={20} />,
        items: [
            { path: '/reports', label: 'Reportes', icon: <BarChart3 size={18} />, feature: 'reports' },
            { path: '/settings', label: 'Configuración', icon: <Settings size={18} />, feature: 'settings' },
            { path: '/inbox', label: 'Inbox', icon: <Inbox size={18} />, feature: 'inbox' as const },
            { path: '/users', label: 'Usuarios', icon: <UserPlus size={18} />, feature: 'users' as const },
            { path: '/templates', label: 'Plantillas', icon: <ClipboardList size={18} />, feature: 'settings' as const },
            { path: '/admin/financial-dashboard', label: 'Dashboard Financiero', icon: <LayoutDashboard size={18} />, feature: 'settings' as const },
            { path: '/audit', label: 'Auditoría', icon: <FileText size={18} />, feature: 'audit' as const }
        ]
    }
];

export const navItems: NavItem[] = navCategories.flatMap((category) => category.items);