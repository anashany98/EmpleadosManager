import { Baby, Calendar as CalendarIcon, Clock, Coffee, FileText, Heart, MoreHorizontal, Plane, Stethoscope, Sun } from 'lucide-react';

export interface VacationRequest {
    id: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    type: string;
    reason?: string | null;
    rejectionReason?: string | null;
    managerComment?: string | null;
    approvedBy?: string | null;
    approvedAt?: string | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    days: number;
    fileUrl?: string | null;
    employee?: {
        name: string;
        department?: string;
    };
}

export interface VacationStats {
    total: number;
    used: number;
    pending: number;
    available: number;
}

export interface VacationBalanceSummary {
    year: number;
    annualQuotaDays: number;
    carriedOverDays: number;
    importedUsedDays: number;
    totalEntitledDays: number;
    approvedUsedDays: number;
    pendingDays: number;
    availableDays: number;
    projectedAvailableDays: number;
}

export interface VacationRequestInput {
    employeeId: string;
    startDate: string;
    endDate: string;
    type: string;
    reason?: string;
    attachment?: File | null;
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
    PERSONAL_DAY: { label: 'Día Personal', color: 'bg-cyan-500', text: 'text-cyan-700', bgSoft: 'bg-cyan-50', border: 'border-cyan-200', icon: Sun },
    PERSONAL: { label: 'Asunto personal', color: 'bg-cyan-500', text: 'text-cyan-700', bgSoft: 'bg-cyan-50', border: 'border-cyan-200', icon: Sun },
    SICK: { label: 'Baja medica', color: 'bg-rose-500', text: 'text-rose-700', bgSoft: 'bg-rose-50', border: 'border-rose-200', icon: Stethoscope },
    SICK_LEAVE: { label: 'Baja medica', color: 'bg-rose-500', text: 'text-rose-700', bgSoft: 'bg-rose-50', border: 'border-rose-200', icon: Stethoscope },
    BAJA_MEDICA: { label: 'Baja medica', color: 'bg-rose-500', text: 'text-rose-700', bgSoft: 'bg-rose-50', border: 'border-rose-200', icon: Stethoscope },
    MATERNITY: { label: 'Maternidad', color: 'bg-pink-500', text: 'text-pink-700', bgSoft: 'bg-pink-50', border: 'border-pink-200', icon: Baby },
    MATERNIDAD: { label: 'Maternidad', color: 'bg-pink-500', text: 'text-pink-700', bgSoft: 'bg-pink-50', border: 'border-pink-200', icon: Baby },
    PATERNITY: { label: 'Paternidad', color: 'bg-sky-500', text: 'text-sky-700', bgSoft: 'bg-sky-50', border: 'border-sky-200', icon: Baby },
    PATERNIDAD: { label: 'Paternidad', color: 'bg-sky-500', text: 'text-sky-700', bgSoft: 'bg-sky-50', border: 'border-sky-200', icon: Baby },
    MEDICAL_APPOINTMENT: { label: 'Cita médica', color: 'bg-indigo-500', text: 'text-indigo-700', bgSoft: 'bg-indigo-50', border: 'border-indigo-200', icon: Clock },
    MEDICAL_HOURS: { label: 'Horas médicas', color: 'bg-indigo-500', text: 'text-indigo-700', bgSoft: 'bg-indigo-50', border: 'border-indigo-200', icon: Clock },
    UNPAID: { label: 'Permiso sin goce', color: 'bg-amber-500', text: 'text-amber-700', bgSoft: 'bg-amber-50', border: 'border-amber-200', icon: FileText },
    OTHER: { label: 'Otros', color: 'bg-slate-500', text: 'text-slate-700', bgSoft: 'bg-slate-50', border: 'border-slate-200', icon: MoreHorizontal },
    OTROS: { label: 'Otros', color: 'bg-slate-500', text: 'text-slate-700', bgSoft: 'bg-slate-50', border: 'border-slate-200', icon: MoreHorizontal },
    MARRIAGE: { label: 'Boda', color: 'bg-rose-500', text: 'text-rose-700', bgSoft: 'bg-rose-50', border: 'border-rose-200', icon: Heart },
    DEATH: { label: 'Fallecimiento', color: 'bg-slate-700', text: 'text-slate-700', bgSoft: 'bg-slate-50', border: 'border-slate-200', icon: FileText },
    MOVING: { label: 'Mudanza', color: 'bg-amber-500', text: 'text-amber-700', bgSoft: 'bg-amber-50', border: 'border-amber-200', icon: Plane },
    FAMILY_SICK: { label: 'Enfermedad familiar', color: 'bg-rose-500', text: 'text-rose-700', bgSoft: 'bg-rose-50', border: 'border-rose-200', icon: Stethoscope },
    PUBLIC_DUTY: { label: 'Función pública', color: 'bg-blue-500', text: 'text-blue-700', bgSoft: 'bg-blue-50', border: 'border-blue-200', icon: FileText },
    LACTANCIA: { label: 'Lactancia', color: 'bg-pink-500', text: 'text-pink-700', bgSoft: 'bg-pink-50', border: 'border-pink-200', icon: Baby },
    TELETRABAJO: { label: 'Teletrabajo', color: 'bg-violet-500', text: 'text-violet-700', bgSoft: 'bg-violet-50', border: 'border-violet-200', icon: Coffee },
    PERMISO_SINDICAL: { label: 'Permiso sindical', color: 'bg-teal-500', text: 'text-teal-700', bgSoft: 'bg-teal-50', border: 'border-teal-200', icon: FileText },
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
