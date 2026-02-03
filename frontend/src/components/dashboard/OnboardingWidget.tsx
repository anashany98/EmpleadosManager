
import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { motion } from 'framer-motion';
import { Square, CheckCircle2, ListChecks } from 'lucide-react';

export default function OnboardingWidget({ employeeId }: { employeeId: string }) {
    const [checklists, setChecklists] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (employeeId) {
            fetchChecklists();
        }
    }, [employeeId]);

    const fetchChecklists = async () => {
        try {
            const res = await api.get(`/onboarding/employee/${employeeId}`);
            setChecklists(res.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const toggleItem = async (checklistId: string, itemIdx: number) => {
        const checklist = checklists.find(c => c.id === checklistId);
        if (!checklist) return;

        const newItems = [...checklist.items];
        newItems[itemIdx].completed = !newItems[itemIdx].completed;

        // Optimistic update
        setChecklists(prev => prev.map(c => c.id === checklistId ? { ...c, items: newItems } : c));

        try {
            await api.put(`/onboarding/checklist/${checklistId}`, { items: newItems });
        } catch (error) {
            // Revert on error
            console.error(error);
            fetchChecklists();
        }
    };

    if (loading) return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-2xl"></div>;
    if (checklists.length === 0) return null; // Don't show if empty

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-slate-900 dark:text-white">
                <ListChecks className="text-blue-600" size={20} />
                Onboarding & Tareas
            </h3>

            <div className="space-y-6">
                {checklists.map(checklist => {
                    const progress = Math.round((checklist.items.filter((i: any) => i.completed).length / checklist.items.length) * 100);

                    return (
                        <div key={checklist.id} className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h4 className="font-semibold text-slate-800 dark:text-slate-200">{checklist.title}</h4>
                                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                                    {progress}%
                                </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-blue-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>

                            <ul className="space-y-2 mt-2">
                                {checklist.items.map((item: any, idx: number) => (
                                    <li
                                        key={idx}
                                        onClick={() => toggleItem(checklist.id, idx)}
                                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors group"
                                    >
                                        <div className={`mt-0.5 ${item.completed ? 'text-green-500' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                            {item.completed ? <CheckCircle2 size={18} /> : <Square size={18} />}
                                        </div>
                                        <span className={`text-sm ${item.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {item.text}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
