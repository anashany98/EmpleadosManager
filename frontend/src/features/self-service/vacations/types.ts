import { Baby, Calendar as CalendarIcon, Clock, FileText, MoreHorizontal, Plane, Stethoscope } from 'lucide-react';

export interface VacationRequest {
    id: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    type: string;
    reason?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    days: number;
    fileUrl?: string;
    employee?: {
        name: string;
        department?: string;
    };
}

interface AbsenceTypeConfig {
    label: string;
    color: string;
    text: string;
    bgSoft: string;
    border: string;
    icon: typeof Plane;
}

export const ABSENCE_TYPES: Record<string, AbsenceTypeConfig> = {
    VACATION: { label: 'Vacaciones', color: 'bg-emerald-500', text: 'text-emerald-700', bgSoft: 'bg-emerald-50', border: 'border-emerald-200', icon: Plane },
    SICK: { label: 'Baja medica', color: 'bg-rose-500', text: 'text-rose-700', bgSoft: 'bg-rose-50', border: 'border-rose-200', icon: Stethoscope },
    BIRTH: { label: 'Nacimiento', color: 'bg-blue-500', text: 'text-blue-700', bgSoft: 'bg-blue-50', border: 'border-blue-200', icon: Baby },
    MEDICAL_HOURS: { label: 'Medico', color: 'bg-indigo-500', text: 'text-indigo-700', bgSoft: 'bg-indigo-50', border: 'border-indigo-200', icon: Clock },
    PERSONAL: { label: 'Personal', color: 'bg-amber-500', text: 'text-amber-700', bgSoft: 'bg-amber-50', border: 'border-amber-200', icon: FileText },
    OTHER: { label: 'Otros', color: 'bg-slate-500', text: 'text-slate-700', bgSoft: 'bg-slate-50', border: 'border-slate-200', icon: MoreHorizontal }
};

export const DAY_NAMES = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

export const formatVacationRange = (startDate: string, endDate: string): string => {
    return `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
};

export const isVacationToday = (date: Date, reference: Date): boolean => {
    return (
        date.getDate() === reference.getDate() &&
        date.getMonth() === reference.getMonth() &&
        date.getFullYear() === reference.getFullYear()
    );
};

export const CalendarIconSmall = CalendarIcon;
