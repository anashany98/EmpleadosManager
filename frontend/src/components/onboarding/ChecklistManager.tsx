
import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { toast } from 'sonner';
import { Plus, Trash2, ListChecks, UserPlus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Template {
    id: string;
    title: string;
    description: string;
    items: string[];
    createdAt: string;
}

export default function ChecklistManager() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // New Template State
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newItem, setNewItem] = useState('');
    const [newItems, setNewItems] = useState<string[]>([]);

    // Assign State
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [employeeIdToAssign, setEmployeeIdToAssign] = useState('');
    const [employees, setEmployees] = useState<any[]>([]); // simplified

    useEffect(() => {
        fetchTemplates();
        fetchEmployees();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await api.get('/onboarding/templates');
            setTemplates(res.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/employees');
            setEmployees(res.data || []);
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddItem = () => {
        if (!newItem.trim()) return;
        setNewItems([...newItems, newItem.trim()]);
        setNewItem('');
    };

    const handleCreateTemplate = async () => {
        if (!newTitle || newItems.length === 0) {
            toast.error('Título y al menos un item son requeridos');
            return;
        }

        try {
            await api.post('/onboarding/templates', {
                title: newTitle,
                description: newDesc,
                items: newItems
            });
            toast.success('Plantilla creada');
            setIsCreating(false);
            setNewTitle('');
            setNewDesc('');
            setNewItems([]);
            fetchTemplates();
        } catch (error) {
            toast.error('Error al crear plantilla');
        }
    };

    const handleAssign = async () => {
        if (!selectedTemplate || !employeeIdToAssign) return;
        try {
            await api.post('/onboarding/assign', {
                employeeId: employeeIdToAssign,
                templateId: selectedTemplate.id
            });
            toast.success('Asignado correctamente');
            setAssignModalOpen(false);
            setSelectedTemplate(null);
            setEmployeeIdToAssign('');
        } catch (error) {
            toast.error('Error al asignar');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <ListChecks className="text-blue-600" />
                    Plantillas de Onboarding
                </h2>
                <button
                    onClick={() => setIsCreating(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
                >
                    <Plus size={18} /> Nueva Plantilla
                </button>
            </div>

            {/* Create Form */}
            <AnimatePresence>
                {isCreating && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-slate-50 dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                    >
                        <div className="space-y-4">
                            <input
                                placeholder="Título de la plantilla (ej: Nuevo Desarrollador)"
                                className="w-full p-2 rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                            />
                            <textarea
                                placeholder="Descripción opcional"
                                className="w-full p-2 rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                                value={newDesc}
                                onChange={e => setNewDesc(e.target.value)}
                            />

                            <div className="space-y-2">
                                <label className="text-sm font-bold">Tareas / Items</label>
                                <div className="flex gap-2">
                                    <input
                                        placeholder="Nueva tarea..."
                                        className="flex-1 p-2 rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                                        value={newItem}
                                        onChange={e => setNewItem(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                                    />
                                    <button onClick={handleAddItem} className="bg-slate-200 dark:bg-slate-700 p-2 rounded hover:bg-slate-300"><Plus size={20} /></button>
                                </div>
                                <ul className="space-y-1">
                                    {newItems.map((item, idx) => (
                                        <li key={idx} className="flex justify-between bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 text-sm">
                                            <span>{item}</span>
                                            <button onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))} className="text-red-500">
                                                <Trash2 size={14} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setIsCreating(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">Cancelar</button>
                                <button onClick={handleCreateTemplate} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Guardar Plantilla</button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* List */}
            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map(t => (
                        <div key={t.id} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="font-bold text-lg">{t.title}</h3>
                                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs px-2 py-1 rounded font-mono">
                                    {t.items.length} tareas
                                </div>
                            </div>
                            <p className="text-sm text-slate-500 mb-4 line-clamp-2">{t.description || 'Sin descripción'}</p>

                            <button
                                onClick={() => { setSelectedTemplate(t); setAssignModalOpen(true); }}
                                className="w-full py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <UserPlus size={16} /> Asignar a Empleado
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Assign Modal */}
            <AnimatePresence>
                {assignModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-900 p-6 rounded-2xl w-full max-w-md shadow-2xl"
                        >
                            <h3 className="text-xl font-bold mb-4">Asignar "{selectedTemplate?.title}"</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Seleccionar Empleado</label>
                                    <select
                                        className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                                        value={employeeIdToAssign}
                                        onChange={e => setEmployeeIdToAssign(e.target.value)}
                                    >
                                        <option value="">Selecciona un empleado...</option>
                                        {employees.map(e => (
                                            <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2 justify-end pt-4">
                                    <button onClick={() => setAssignModalOpen(false)} className="px-4 py-2 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                    <button onClick={handleAssign} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Asignar</button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
