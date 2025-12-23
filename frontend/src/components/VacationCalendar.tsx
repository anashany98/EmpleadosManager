import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info, Trash2, Plane, Stethoscope, Baby, Clock, FileText, MoreHorizontal, Gift } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { isHoliday, getBusinessDaysCount } from '../utils/holidays';

const ABSENCE_TYPES = [
    { id: 'VACATION', label: 'Vacaciones', bg: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50', icon: Plane },
    { id: 'SICK', label: 'Baja Médica', bg: 'bg-rose-500', text: 'text-rose-700', light: 'bg-rose-50', icon: Stethoscope },
    { id: 'BIRTH', label: 'Nacimiento/Cuidado', bg: 'bg-blue-500', text: 'text-blue-700', light: 'bg-blue-50', icon: Baby },
    { id: 'MEDICAL_HOURS', label: 'Horas Médicas', bg: 'bg-indigo-500', text: 'text-indigo-700', light: 'bg-indigo-50', icon: Clock },
    { id: 'PERSONAL', label: 'Asuntos Propios', bg: 'bg-amber-500', text: 'text-amber-700', light: 'bg-amber-50', icon: FileText },
    { id: 'OTHER', label: 'Otros', bg: 'bg-slate-500', text: 'text-slate-700', light: 'bg-slate-50', icon: MoreHorizontal },
];

export default function VacationCalendar({ employeeId }: { employeeId: string }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [vacations, setVacations] = useState<any[]>([]);
    const [selection, setSelection] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });
    const [employeeData, setEmployeeData] = useState<any>(null);
    const [selectedType, setSelectedType] = useState('VACATION');
    const [reason, setReason] = useState('');
    const [medicalHours, setMedicalHours] = useState('');

    useEffect(() => {
        fetchVacations();
        fetchEmployee();
    }, [employeeId]);

    const fetchEmployee = async () => {
        try {
            const data = await api.get(`/employees/${employeeId}`);
            setEmployeeData(data);
        } catch (e) { console.error(e); }
    };

    const fetchVacations = async () => {
        try {
            const data = await api.get(`/vacations/employee/${employeeId}`);
            setVacations(data);
        } catch (e) { console.error(e); }
    };

    const generatePDF = async (v: any) => {
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF();

        const typeLabel = getAbsenceLabel(v.type);
        const startStr = new Date(v.startDate).toLocaleDateString();
        const endStr = new Date(v.endDate).toLocaleDateString();
        const empName = `${employeeData?.name} ${employeeData?.lastName || ''} `;

        // Header
        doc.setFillColor(59, 130, 246); // Blue-500
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text('JUSTIFICANTE DE AUSENCIA', 105, 25, { align: 'center' });

        // Content
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        let y = 60;

        doc.setFont('helvetica', 'bold');
        doc.text('Datos del Empleado:', 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(empName, 70, y);
        y += 10;

        doc.setFont('helvetica', 'bold');
        doc.text('DNI:', 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(employeeData?.dni || '-', 70, y);
        y += 20;

        doc.setFont('helvetica', 'bold');
        doc.text('Tipo de Ausencia:', 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(typeLabel, 70, y);
        y += 10;

        if (v.reason) {
            doc.setFont('helvetica', 'bold');
            doc.text('Detalles:', 20, y);
            doc.setFont('helvetica', 'normal');
            doc.text(v.reason, 70, y);
            y += 10;
        }

        doc.setFont('helvetica', 'bold');
        doc.text('Periodo:', 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`Del ${startStr} al ${endStr} `, 70, y);
        y += 30;

        // Signature box
        doc.setDrawColor(200, 200, 200);
        doc.rect(20, y, 80, 40);
        doc.rect(110, y, 80, 40);
        doc.setFontSize(8);
        doc.text('Firma del Empleado', 60, y + 45, { align: 'center' });
        doc.text('Sello/Firma Empresa', 150, y + 45, { align: 'center' });

        doc.save(`Justificante_${typeLabel.replace(/\s/g, '_')}_${empName.replace(/\s/g, '_')}.pdf`);
    };

    const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay(); // 0 = Sun
    };

    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const offset = firstDay === 0 ? 6 : firstDay - 1; // Ajuste para Lunes = 0

    const handleDayClick = async (day: number) => {
        const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);

        const existing = getVacationByDay(day);
        if (existing) {
            const label = getAbsenceLabel(existing.type);
            const detail = existing.reason ? ` (${existing.reason})` : '';

            const action = confirm(`Registro: ${label}${detail} \nDel ${new Date(existing.startDate).toLocaleDateString()} al ${new Date(existing.endDate).toLocaleDateString()} \n\nAceptar -> Descargar PDF\nCancelar -> Ignorar\n(Si quieres eliminar, usa el icono de papelera)`);

            if (action) {
                generatePDF(existing);
            }
            return;
        }

        if (!selection.start || (selection.start && selection.end)) {
            setSelection({ start: clickedDate, end: null });
            toast.info(`Inicio: ${clickedDate.toLocaleDateString()}. Selecciona fin.`);
        } else if (clickedDate < selection.start) {
            setSelection({ start: clickedDate, end: null });
        } else {
            const end = clickedDate;
            setSelection(prev => ({ ...prev, end }));

            const typeLabel = getAbsenceLabel(selectedType);
            const detail = selectedType === 'OTHER' && reason ? ` [${reason}]` : '';

            if (confirm(`¿Registrar ${typeLabel}${detail}?\nDel ${selection.start.toLocaleDateString()} al ${end.toLocaleDateString()} `)) {
                const toastId = toast.loading('Registrando...');
                try {
                    await api.post('/vacations', {
                        employeeId,
                        startDate: selection.start.toISOString(),
                        endDate: end.toISOString(),
                        type: selectedType,
                        reason: selectedType === 'MEDICAL_HOURS' ? medicalHours : (selectedType === 'OTHER' ? reason : null)
                    });
                    toast.success(`${typeLabel} registrado con éxito`, { id: toastId });
                    setSelection({ start: null, end: null });
                    setReason('');
                    setMedicalHours('');
                    fetchVacations();
                    fetchEmployee();
                } catch (err: any) {
                    const message = err.message || 'Error al registrar';
                    toast.error(message, { id: toastId });
                    setSelection({ start: null, end: null });
                }
            } else {
                setSelection({ start: null, end: null });
            }
        }
    };

    const getVacationByDay = (day: number) => {
        const target = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        target.setHours(0, 0, 0, 0);
        return vacations.find(v => {
            const start = new Date(v.startDate);
            const end = new Date(v.endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
            return target >= start && target <= end;
        });
    };

    const isInSelection = (day: number) => {
        if (!selection.start) return false;
        const target = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        target.setHours(0, 0, 0, 0);
        const s = new Date(selection.start); s.setHours(0, 0, 0, 0);
        if (selection.end) {
            const e = new Date(selection.end); e.setHours(0, 0, 0, 0);
            return target >= s && target <= e;
        }
        return target.getTime() === s.getTime();
    };

    const getAbsenceLabel = (type: string) => ABSENCE_TYPES.find(t => t.id === type)?.label || type;
    const getAbsenceColor = (type: string) => ABSENCE_TYPES.find(t => t.id === type)?.bg || 'bg-slate-500';

    const usedDays = vacations.reduce((acc, v) => {
        if (v.type !== 'VACATION') return acc;

        const start = new Date(v.startDate);
        const end = new Date(v.endDate);
        if (start.getFullYear() === currentDate.getFullYear()) {
            return acc + getBusinessDaysCount(start, end);
        }
        return acc;
    }, 0);

    // Calcular cupo proporcional según fecha de entrada (por días exactos)
    const calculateProportionalQuota = () => {
        const baseQuota = employeeData?.vacationDaysTotal || 30;
        const entryDate = employeeData?.entryDate || employeeData?.seniorityDate;

        if (!entryDate) return baseQuota;

        const entry = new Date(entryDate);
        const currentYear = currentDate.getFullYear();
        const entryYear = entry.getFullYear();

        // Si entró antes del año actual, tiene el cupo completo
        if (entryYear < currentYear) return baseQuota;

        // Si entró este año, calcular proporcionalmente por días
        if (entryYear === currentYear) {
            const yearStart = new Date(currentYear, 0, 1);
            const yearEnd = new Date(currentYear, 11, 31);
            const totalDaysInYear = Math.ceil((yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

            const entryNormalized = new Date(entry);
            entryNormalized.setHours(0, 0, 0, 0);

            const daysWorkedInYear = Math.ceil((yearEnd.getTime() - entryNormalized.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const proportionalQuota = Math.round((baseQuota * daysWorkedInYear) / totalDaysInYear);

            return Math.max(0, proportionalQuota);
        }

        // Si aún no ha entrado (fecha futura), no tiene cupo
        return 0;
    };

    const quota = calculateProportionalQuota();

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
            <div className="space-y-6 mb-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                            <CalendarIcon className="text-blue-600" size={24} /> Calendario de Ausencias
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Sábados/Domingos aislados no consumen cupo de vacaciones</p>
                    </div>

                    <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="text-center">
                            <p className="text-[10px] uppercase font-bold text-slate-400">Cupo 30d</p>
                            <p className="text-md font-bold text-slate-700 dark:text-slate-200">{Math.max(0, quota - usedDays)} disp.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {ABSENCE_TYPES.map(t => {
                        const Icon = t.icon;
                        const isSelected = selectedType === t.id;
                        return (
                            <button
                                key={t.id}
                                onClick={() => setSelectedType(t.id)}
                                className={`
                                    flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                                    ${isSelected
                                        ? `bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900 shadow-lg ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900`
                                        : 'bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-blue-500 hover:text-slate-600'
                                    }
                            `}
                            >
                                <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
                                    <Icon size={18} className={isSelected ? 'text-white dark:text-slate-900' : 'text-slate-500'} />
                                </div>
                                <span className="font-bold text-sm">{t.label}</span>
                            </button>
                        );
                    })}
                </div>

                {selectedType === 'OTHER' && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-1">
                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Detalla el motivo (Opcional)</label>
                        <input
                            type="text"
                            placeholder="Ej: Permiso por mudanza, formación..."
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>
                )}

                {selectedType === 'MEDICAL_HOURS' && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/40 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800 shadow-sm animate-in fade-in zoom-in-95 duration-200 my-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Clock size={18} className="text-indigo-500" />
                            <label className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Registrar Horas Médicas</label>
                        </div>
                        <div className="flex items-center gap-4">
                            <input
                                type="number"
                                step="0.5"
                                min="0.5"
                                placeholder="Ej: 2.5"
                                className="w-36 bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-3 text-lg font-black text-indigo-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-inner"
                                value={medicalHours}
                                onChange={(e) => setMedicalHours(e.target.value)}
                            />
                            <div>
                                <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100">Horas</p>
                                <p className="text-[10px] text-indigo-500 font-medium">Se reflejará en el calendario</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center mb-6">
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                    <ChevronLeft size={20} />
                </button>
                <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize w-48 text-center text-lg">
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                    <ChevronRight size={20} />
                </button>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center mb-4">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                    <div key={d} className="text-xs font-bold text-slate-400 uppercase tracking-wider">{d}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                    const existing = getVacationByDay(day);
                    const selected = isInSelection(day);
                    const isWeekend = [6, 0].includes(date.getDay());
                    const holiday = isHoliday(date);

                    return (
                        <button
                            key={day}
                            onClick={() => handleDayClick(day)}
                            className={`
                                min-h-[100px] md:min-h-[140px] rounded-2xl flex flex-col items-center justify-center text-sm font-bold transition-all relative overflow-hidden group
                                ${existing
                                    ? `${getAbsenceColor(existing.type)} text-white shadow-lg shadow-${getAbsenceColor(existing.type).split('-')[1]}-500/20`
                                    : selected
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-105 z-10'
                                        : holiday
                                            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                            : isWeekend
                                                ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500'
                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-600'
                                }
                            `}
                        >
                            <span className="text-lg relative z-10">{day}</span>
                            {holiday && <Gift size={12} className="absolute top-2 left-2 opacity-70" />}
                            {existing && (
                                <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                                    {existing.type === 'MEDICAL_HOURS' && existing.reason && (
                                        <div className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] font-black backdrop-blur-sm mb-1">
                                            {existing.reason}h
                                        </div>
                                    )}
                                    <Trash2 size={12} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="mt-8 flex flex-wrap gap-4 text-xs font-medium">
                {ABSENCE_TYPES.map(t => (
                    <div key={t.id} className="flex items-center gap-2">
                        <div className={`w-3 h-3 ${t.bg} rounded-full`}></div>
                        <span className="text-slate-500">{t.label}</span>
                    </div>
                ))}
            </div>

            <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex gap-3 items-start border border-blue-100 dark:border-blue-800/30">
                <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                    **Gestión de Ausencias**: Selecciona el tipo arriba y haz clic en el rango del calendario. Para borrar, haz clic en un día ya registrado. Las vacaciones solo descuentan del cupo si incluyen días laborables.
                </p>
            </div>
        </div>
    );
}
