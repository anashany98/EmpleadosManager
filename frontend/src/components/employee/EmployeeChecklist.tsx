import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { ClipboardList, Plus, Trash2, CheckCircle2, Circle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Task {
    id: string;
    type: 'ONBOARDING' | 'OFFBOARDING';
    title: string;
    description?: string;
    completed: boolean;
    completedAt?: string;
    deadline?: string;
}

export default function EmployeeChecklist({ employeeId }: { employeeId: string }) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'ONBOARDING' | 'OFFBOARDING'>('ONBOARDING');
    const [showAdd, setShowAdd] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        deadline: ''
    });

    useEffect(() => {
        fetchTasks();
    }, [employeeId, activeTab]);

    const fetchTasks = async () => {
        try {
            const resp = await api.get(`/checklists/employee/${employeeId}?type=${activeTab}`);
            setTasks(resp.data);
        } catch (error) {
            toast.error('Error al cargar tareas');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/checklists', {
                ...formData,
                employeeId,
                type: activeTab
            });
            toast.success('Tarea añadida');
            setShowAdd(false);
            setFormData({ title: '', description: '', deadline: '' });
            fetchTasks();
        } catch (error) {
            toast.error('Error al crear tarea');
        }
    };

    const handleToggle = async (id: string, currentStatus: boolean) => {
        try {
            await api.put(`/checklists/${id}/toggle`, { completed: !currentStatus });
            fetchTasks();
        } catch (error) {
            toast.error('Error al actualizar');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            if (!confirm('¿Eliminar esta tarea?')) return;
            await api.delete(`/checklists/${id}`);
            toast.success('Tarea eliminada');
            fetchTasks();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    if (loading) return <div>Cargando checklists...</div>;

    const completedCount = tasks.filter(t => t.completed).length;
    const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                    <button
                        onClick={() => setActiveTab('ONBOARDING')}
                        className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'ONBOARDING' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        Onboarding
                    </button>
                    <button
                        onClick={() => setActiveTab('OFFBOARDING')}
                        className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'OFFBOARDING' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        Offboarding
                    </button>
                </div>

                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 border border-slate-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Tarea
                </button>
            </div>

            {/* Progress Bar */}
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Estado del Proceso</span>
                    <span className="text-sm text-slate-400 font-mono">{completedCount} / {tasks.length}</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${activeTab === 'ONBOARDING' ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {showAdd && (
                <form onSubmit={handleCreate} className="bg-slate-800/80 p-5 rounded-2xl border border-blue-500/30 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300 shadow-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Título de la Tarea</label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl text-sm text-white px-4 py-2.5 outline-none focus:border-blue-500 transition-colors"
                                placeholder="Ej: Entrega de llaves, Firma de contrato..."
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Descripción (Opcional)</label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl text-sm text-white px-4 py-2.5 outline-none focus:border-blue-500 transition-colors"
                                placeholder="Detalles de la tarea..."
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Fecha Límite</label>
                            <input
                                type="date"
                                value={formData.deadline}
                                onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl text-sm text-white px-4 py-2.5 outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowAdd(false)}
                            className="px-6 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            Añadir Tarea
                        </button>
                    </div>
                </form>
            )}

            <div className="space-y-3">
                {tasks.length === 0 ? (
                    <div className="text-center py-16 bg-slate-800/10 rounded-3xl border-2 border-dashed border-slate-800">
                        <ClipboardList className="w-16 h-16 text-slate-700 mx-auto mb-4 opacity-50" />
                        <p className="text-slate-500 font-medium tracking-tight">No hay tareas configuradas para este proceso</p>
                        <button onClick={() => setShowAdd(true)} className="text-blue-500 text-sm mt-2 hover:underline">Crear la primera tarea</button>
                    </div>
                ) : (
                    tasks.map(task => (
                        <div
                            key={task.id}
                            className={`group p-4 rounded-2xl border transition-all flex items-start gap-4 ${task.completed
                                ? 'bg-slate-900/40 border-slate-800 hover:bg-slate-900/60'
                                : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-500 hover:bg-slate-800/60'
                                }`}
                        >
                            <button
                                onClick={() => handleToggle(task.id, task.completed)}
                                className={`mt-1 transition-all transform hover:scale-110 ${task.completed ? 'text-green-500' : 'text-slate-600 hover:text-blue-500'}`}
                            >
                                {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                            </button>

                            <div className="flex-1 min-w-0">
                                <div className={`text-base font-semibold leading-tight ${task.completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                                    {task.title}
                                </div>
                                {task.description && (
                                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{task.description}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2.5">
                                    {task.deadline && (
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest font-black">
                                            <Clock className="w-3 h-3 text-amber-500/70" />
                                            Límite: {new Date(task.deadline).toLocaleDateString()}
                                        </div>
                                    )}
                                    {task.completedAt && (
                                        <div className="text-[10px] text-green-500/70 uppercase tracking-widest font-black flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                            Completada {new Date(task.completedAt).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => handleDelete(task.id)}
                                className="p-2 text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 transform translate-x-1 group-hover:translate-x-0"
                            >
                                <Trash2 className="w-4.5 h-4.5" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
