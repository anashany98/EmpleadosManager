import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { toast } from 'sonner';
import { HardHat, Plus, Trash2, Clock, MapPin, Loader2, ArrowRight, Info } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface Project {
    id: string;
    code: string;
    name: string;
    destination: string | null;
}

interface WorkEntry {
    id: string;
    startDate: string;
    endDate: string;
    hours: number;
    notes: string | null;
    project: Project;
}

export default function EmployeeProjects({ employeeId }: { employeeId: string }) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [hours, setHours] = useState(8);
    const [notes, setNotes] = useState('');

    // Project creation state
    const [showNewProject, setShowNewProject] = useState(false);
    const [newProjName, setNewProjName] = useState('');
    const [newProjCode, setNewProjCode] = useState('');
    const [newProjDest, setNewProjDest] = useState('');

    const calculateTotalHours = (start: string, end: string, dailyHours: number) => {
        const days = differenceInDays(new Date(end), new Date(start)) + 1;
        return days * dailyHours;
    };

    useEffect(() => {
        fetchData();
    }, [employeeId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [projRes, workRes] = await Promise.all([
                api.get('/projects'),
                api.get(`/employee-project-work/employee/${employeeId}`)
            ]);
            setProjects(projRes);
            setWorkEntries(workRes);
        } catch (error) {
            toast.error('Error al cargar datos de obras');
        } finally {
            setLoading(false);
        }
    };

    const handleAddWork = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProjectId) {
            toast.error('Selecciona una obra');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            toast.error('La fecha de inicio no puede ser posterior a la de fin');
            return;
        }

        setSaving(true);
        try {
            await api.post('/employee-project-work', {
                employeeId,
                projectId: selectedProjectId,
                startDate,
                endDate,
                hours,
                notes
            });
            toast.success('Periodo de obra registrado');
            setNotes('');
            fetchData();
        } catch (error) {
            toast.error('Error al guardar registro');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateProject = async () => {
        if (!newProjName || !newProjCode) {
            toast.error('Nombre y código son obligatorios');
            return;
        }

        try {
            const newProj = await api.post('/projects', {
                name: newProjName,
                code: newProjCode,
                destination: newProjDest
            });
            setProjects([newProj, ...projects]);
            setSelectedProjectId(newProj.id);
            setShowNewProject(false);
            setNewProjName('');
            setNewProjCode('');
            setNewProjDest('');
            toast.success('Obra creada correctamente');
        } catch (error) {
            toast.error('Error al crear obra');
        }
    };

    const handleDeleteWork = async (id: string) => {
        if (!confirm('¿Eliminar este registro?')) return;
        try {
            await api.delete(`/employee-project-work/${id}`);
            toast.success('Registro eliminado');
            fetchData();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    if (loading) return <div className="p-10 text-center animate-pulse"><Loader2 className="animate-spin mx-auto mb-4" /> Cargando obras...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <HardHat className="text-amber-500" size={24} /> Control de Obras y Destinos
                    </h3>
                    <p className="text-sm text-slate-500">Asignación de periodos de trabajo por proyecto</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Formulario de registro */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm h-fit">
                    <h4 className="font-bold text-slate-900 dark:text-white mb-4">Registrar Periodo</h4>
                    <form onSubmit={handleAddWork} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase">Obra / Proyecto</label>
                            <div className="flex gap-2">
                                <select
                                    value={selectedProjectId}
                                    onChange={(e) => setSelectedProjectId(e.target.value)}
                                    className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm outline-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Seleccionar obra...</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setShowNewProject(!showNewProject)}
                                    className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-all"
                                    title="Nueva Obra"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>

                        {showNewProject && (
                            <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                <input placeholder="Nombre de obra" value={newProjName} onChange={e => setNewProjName(e.target.value)} className="w-full bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg text-sm border-none ring-1 ring-blue-200 dark:ring-blue-900" />
                                <input placeholder="Código (Ej: 24-001)" value={newProjCode} onChange={e => setNewProjCode(e.target.value)} className="w-full bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg text-sm border-none ring-1 ring-blue-200 dark:ring-blue-900" />
                                <input placeholder="Destino (Ciudad/Lugar)" value={newProjDest} onChange={e => setNewProjDest(e.target.value)} className="w-full bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg text-sm border-none ring-1 ring-blue-200 dark:ring-blue-900" />
                                <button type="button" onClick={handleCreateProject} className="w-full bg-blue-600 text-white py-1.5 rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20">Crear Obra</button>
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 uppercase">Fecha Inicio</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm outline-none ring-1 ring-slate-200 dark:ring-slate-700" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 uppercase">Fecha Fin</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm outline-none ring-1 ring-slate-200 dark:ring-slate-700" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 uppercase">Horas por día</label>
                                <input type="number" step="0.5" value={hours} onChange={e => setHours(parseFloat(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm outline-none ring-1 ring-slate-200 dark:ring-slate-700" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase">Notas (Opcional)</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm outline-none ring-1 ring-slate-200 dark:ring-slate-700 h-20 resize-none" placeholder="Observaciones..." />
                        </div>

                        <button
                            disabled={saving}
                            className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-3 rounded-xl font-bold transition-all hover:bg-slate-800 flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                            Guardar Registro
                        </button>
                    </form>
                </div>

                {/* Historial */}
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Periodo</th>
                                    <th className="px-6 py-4">Obra / Código</th>
                                    <th className="px-6 py-4">Destino</th>
                                    <th className="px-6 py-4 text-center">Horas</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {workEntries.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No hay días de obra registrados</td>
                                    </tr>
                                ) : (
                                    workEntries.map(entry => (
                                        <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="text-center">
                                                        <div className="font-bold text-slate-900 dark:text-white truncate">
                                                            {format(new Date(entry.startDate), "dd/MM/yy")}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 uppercase">
                                                            {format(new Date(entry.startDate), "EEE", { locale: es })}
                                                        </div>
                                                    </div>
                                                    <ArrowRight size={14} className="text-slate-300" />
                                                    <div className="text-center">
                                                        <div className="font-bold text-slate-900 dark:text-white truncate">
                                                            {format(new Date(entry.endDate), "dd/MM/yy")}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 uppercase">
                                                            {format(new Date(entry.endDate), "EEE", { locale: es })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div>
                                                        <div className="font-bold text-blue-600 dark:text-blue-400 truncate max-w-[150px]">
                                                            {entry.project.name}
                                                        </div>
                                                        <div className="text-xs text-slate-500 font-mono">
                                                            {entry.project.code}
                                                        </div>
                                                    </div>
                                                    {entry.notes && (
                                                        <div className="relative group/note">
                                                            <Info size={14} className="text-slate-400 cursor-help" />
                                                            <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 invisible group-hover/note:opacity-100 group-hover/note:visible transition-all z-50 shadow-xl border border-slate-700 pointer-events-none">
                                                                {entry.notes}
                                                                <div className="absolute top-full left-2 border-8 border-transparent border-t-slate-800" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                                <div className="flex items-center gap-1">
                                                    <MapPin size={12} className="text-slate-400" />
                                                    {entry.project.destination || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="inline-flex flex-col items-center bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl min-w-[70px]">
                                                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                                                        {calculateTotalHours(entry.startDate, entry.endDate, entry.hours)}h
                                                    </div>
                                                    <div className="text-[9px] text-slate-500 flex items-center gap-0.5">
                                                        <Clock size={8} /> {entry.hours}h/día
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDeleteWork(entry.id)}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
