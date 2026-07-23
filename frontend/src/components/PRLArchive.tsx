import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Stethoscope, GraduationCap, Plus, Calendar, Trash2, Check, X, Loader2, Pencil, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { useConfirm } from '../context/ConfirmContext';
import Modal from './ui/Modal';

type MedicalReview = {
    id: string;
    date: string;
    result?: string | null;
    nextReviewDate?: string | null;
    declined?: boolean;
    declineReason?: string | null;
};

type Training = {
    id: string;
    name: string;
    type: string;
    date: string;
    hours?: number | null;
};

const REVIEW_RESULTS = ['APTO', 'NO APTO', 'APTO CON LIMITACIONES', 'PENDIENTE'];
const TRAINING_TYPES = ['PRL', 'TECNICA', 'HABILIDADES', 'OTROS'];

export default function PRLArchive({ employeeId }: { employeeId: string }) {
    const confirmAction = useConfirm();
    const [reviews, setReviews] = useState<MedicalReview[]>([]);
    const [trainings, setTrainings] = useState<Training[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Modal state
    const [reviewModal, setReviewModal] = useState<{ open: boolean; review: MedicalReview | null }>({ open: false, review: null });
    const [trainingModal, setTrainingModal] = useState<{ open: boolean; training: Training | null }>({ open: false, training: null });

    useEffect(() => {
        fetchData();
    }, [employeeId]);

    const fetchData = async () => {
        try {
            const [revs, trains] = await Promise.all([
                api.get(`/employees/${employeeId}/medical-reviews`),
                api.get(`/employees/${employeeId}/trainings`)
            ]);
            setReviews((revs.data || revs || []) as MedicalReview[]);
            setTrainings((trains.data || trains || []) as Training[]);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteReview = async (id: string) => {
        const ok = await confirmAction({
            title: 'Eliminar Revisión Médica',
            message: '¿Estás seguro de eliminar esta revisión médica?',
            confirmText: 'Eliminar',
            type: 'danger'
        });

        if (!ok) return;
        try {
            await api.delete(`/employees/${employeeId}/medical-reviews/${id}`);
            toast.success('Revisión médica eliminada');
            fetchData();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const handleDeleteTraining = async (id: string) => {
        const ok = await confirmAction({
            title: 'Eliminar Formación',
            message: '¿Estás seguro de eliminar esta formación?',
            confirmText: 'Eliminar',
            type: 'danger'
        });

        if (!ok) return;
        try {
            await api.delete(`/employees/${employeeId}/trainings/${id}`);
            toast.success('Formación eliminada');
            fetchData();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const openCreateReview = () => setReviewModal({ open: true, review: null });
    const openEditReview = (r: MedicalReview) => setReviewModal({ open: true, review: r });
    const closeReviewModal = () => setReviewModal({ open: false, review: null });

    const openCreateTraining = () => setTrainingModal({ open: true, training: null });
    const openEditTraining = (t: Training) => setTrainingModal({ open: true, training: t });
    const closeTrainingModal = () => setTrainingModal({ open: false, training: null });

    if (loading) return <div className="p-10 text-center animate-pulse text-slate-500">Cargando datos PRL...</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Revisiones Médicas */}
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Stethoscope className="text-rose-600" size={24} /> Revisiones Médicas
                    </h3>
                    <button
                        onClick={openCreateReview}
                        className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-600 hover:bg-rose-100 transition-all flex items-center gap-1 text-xs font-bold px-2"
                        aria-label="Añadir revisión médica"
                    >
                        <Plus size={18} /> <span className="hidden sm:inline">Añadir</span>
                    </button>
                </div>

                <div className="space-y-4">
                    {reviews.length > 0 ? reviews.map(rev => (
                        <div key={rev.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex justify-between items-center gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-slate-900 dark:text-white">{format(new Date(rev.date), 'dd/MM/yyyy')}</span>
                                    {rev.declined ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">RENUNCIA</span>
                                    ) : (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rev.result === 'APTO' ? 'bg-emerald-500' :
                                            rev.result === 'NO APTO' ? 'bg-rose-500' : 'bg-amber-500'
                                            } text-white`}>
                                            {rev.result || 'PENDIENTE'}
                                        </span>
                                    )}
                                </div>
                                {rev.declined && rev.declineReason && (
                                    <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 italic">"{rev.declineReason}"</p>
                                )}
                                {!rev.declined && rev.nextReviewDate && (
                                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                        <Calendar size={10} /> Próxima: {format(new Date(rev.nextReviewDate), 'dd/MM/yyyy')}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => openEditReview(rev)}
                                    className="text-slate-400 hover:text-indigo-600 transition-colors p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                    aria-label="Editar revisión médica"
                                    title="Editar"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    onClick={() => handleDeleteReview(rev.id)}
                                    className="text-slate-400 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                    aria-label="Eliminar revisión médica"
                                    title="Eliminar"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    )) : (
                        <p className="text-sm text-slate-400 italic py-4">No hay revisiones médicas registradas</p>
                    )}
                </div>
            </div>

            {/* Formación PRL */}
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <GraduationCap className="text-indigo-600" size={24} /> Cursos y Formación
                    </h3>
                    <button
                        onClick={openCreateTraining}
                        className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-100 transition-all flex items-center gap-1 text-xs font-bold px-2"
                        aria-label="Añadir formación"
                    >
                        <Plus size={18} /> <span className="hidden sm:inline">Añadir</span>
                    </button>
                </div>

                <div className="space-y-4">
                    {trainings.length > 0 ? trainings.map(tr => (
                        <div key={tr.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex justify-between items-center gap-2">
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">{tr.name}</h4>
                                <div className="flex items-center gap-3 mt-1 text-[10px] flex-wrap">
                                    <span className="font-bold text-slate-400 uppercase">{tr.type}</span>
                                    <span className="text-slate-500 flex items-center gap-1">
                                        <Calendar size={10} /> {format(new Date(tr.date), 'dd/MM/yyyy')}
                                    </span>
                                    {tr.hours != null && tr.hours > 0 && <span className="text-indigo-600 font-bold">{tr.hours}h</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => openEditTraining(tr)}
                                    className="text-slate-400 hover:text-indigo-600 transition-colors p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                    aria-label="Editar formación"
                                    title="Editar"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    onClick={() => handleDeleteTraining(tr.id)}
                                    className="text-slate-400 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                    aria-label="Eliminar formación"
                                    title="Eliminar"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    )) : (
                        <p className="text-sm text-slate-400 italic py-4">No hay cursos registrados</p>
                    )}
                </div>
            </div>

            {/* Modal: Revisión médica */}
            <ReviewModal
                isOpen={reviewModal.open}
                onClose={closeReviewModal}
                employeeId={employeeId}
                review={reviewModal.review}
                onSaved={() => {
                    closeReviewModal();
                    fetchData();
                }}
                saving={saving}
                setSaving={setSaving}
            />

            {/* Modal: Formación */}
            <TrainingModal
                isOpen={trainingModal.open}
                onClose={closeTrainingModal}
                employeeId={employeeId}
                training={trainingModal.training}
                onSaved={() => {
                    closeTrainingModal();
                    fetchData();
                }}
                saving={saving}
                setSaving={setSaving}
            />
        </div>
    );
}

// =====================================================================
// Modal de Revisión Médica
// =====================================================================
function ReviewModal({
    isOpen,
    onClose,
    employeeId,
    review,
    onSaved,
    saving,
    setSaving
}: {
    isOpen: boolean;
    onClose: () => void;
    employeeId: string;
    review: MedicalReview | null;
    onSaved: () => void;
    saving: boolean;
    setSaving: (b: boolean) => void;
}) {
    const isEdit = Boolean(review);
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [result, setResult] = useState('APTO');
    const [nextDate, setNextDate] = useState('');
    const [declined, setDeclined] = useState(false);
    const [declineReason, setDeclineReason] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (review) {
                setDate(review.date ? format(new Date(review.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
                setResult(review.result || 'APTO');
                setNextDate(review.nextReviewDate ? format(new Date(review.nextReviewDate), 'yyyy-MM-dd') : '');
                setDeclined(Boolean(review.declined));
                setDeclineReason(review.declineReason || '');
            } else {
                setDate(format(new Date(), 'yyyy-MM-dd'));
                setResult('APTO');
                setNextDate('');
                setDeclined(false);
                setDeclineReason('');
            }
        }
    }, [isOpen, review]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                date,
                result: declined ? null : result,
                nextReviewDate: declined ? null : (nextDate || null),
                declined,
                declineReason: declined ? (declineReason.trim() || null) : null
            };
            if (isEdit && review) {
                await api.put(`/employees/${employeeId}/medical-reviews/${review.id}`, payload);
                toast.success('Revisión actualizada');
            } else {
                await api.post(`/employees/${employeeId}/medical-reviews`, payload);
                toast.success('Revisión añadida');
            }
            onSaved();
        } catch (error) {
            toast.error(isEdit ? 'Error al actualizar la revisión' : 'Error al guardar la revisión');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Editar revisión médica' : 'Nueva revisión médica'} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Revisión</label>
                        <input
                            type="date"
                            required
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Resultado</label>
                        <select
                            disabled={declined}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs disabled:opacity-50"
                            value={result}
                            onChange={(e) => setResult(e.target.value)}
                        >
                            {REVIEW_RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Próxima Revisión (Opcional)</label>
                    <input
                        type="date"
                        disabled={declined}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs disabled:opacity-50"
                        value={nextDate}
                        onChange={(e) => setNextDate(e.target.value)}
                    />
                </div>

                {/* Renuncia / declinación */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3 space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={declined}
                            onChange={(e) => setDeclined(e.target.checked)}
                            className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                        />
                        <AlertTriangle size={14} />
                        El empleado renuncia / declina pasar la prueba
                    </label>
                    {declined && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">Motivo (opcional)</label>
                            <input
                                type="text"
                                placeholder="Ej: renuncia expresa, causa religiosa, etc."
                                className="w-full bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-700/50 rounded-lg px-3 py-2 text-xs"
                                value={declineReason}
                                onChange={(e) => setDeclineReason(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                <div className="flex gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold py-2 rounded-xl text-xs hover:bg-slate-200 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        disabled={saving}
                        type="submit"
                        className="flex-1 bg-rose-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-rose-700 transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        {isEdit ? 'Guardar cambios' : 'Guardar revisión'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// =====================================================================
// Modal de Formación / Curso
// =====================================================================
function TrainingModal({
    isOpen,
    onClose,
    employeeId,
    training,
    onSaved,
    saving,
    setSaving
}: {
    isOpen: boolean;
    onClose: () => void;
    employeeId: string;
    training: Training | null;
    onSaved: () => void;
    saving: boolean;
    setSaving: (b: boolean) => void;
}) {
    const isEdit = Boolean(training);
    const [name, setName] = useState('');
    const [type, setType] = useState('PRL');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [hours, setHours] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (training) {
                setName(training.name || '');
                setType(training.type || 'PRL');
                setDate(training.date ? format(new Date(training.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
                setHours(training.hours != null ? String(training.hours) : '');
            } else {
                setName('');
                setType('PRL');
                setDate(format(new Date(), 'yyyy-MM-dd'));
                setHours('');
            }
        }
    }, [isOpen, training]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return toast.error('El nombre del curso es obligatorio');
        setSaving(true);
        try {
            const payload = {
                name: name.trim(),
                type,
                date,
                hours: hours ? parseInt(hours, 10) : null
            };
            if (isEdit && training) {
                await api.put(`/employees/${employeeId}/trainings/${training.id}`, payload);
                toast.success('Formación actualizada');
            } else {
                await api.post(`/employees/${employeeId}/trainings`, payload);
                toast.success('Formación añadida');
            }
            onSaved();
        } catch (error) {
            toast.error(isEdit ? 'Error al actualizar la formación' : 'Error al guardar la formación');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Editar formación' : 'Nueva formación'} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre del Curso</label>
                    <input
                        type="text"
                        required
                        placeholder="Ej: PRL 20h Construcción"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo</label>
                        <select
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                        >
                            {TRAINING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha</label>
                        <input
                            type="date"
                            required
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Horas (Opcional)</label>
                    <input
                        type="number"
                        min="0"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs"
                        value={hours}
                        onChange={(e) => setHours(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold py-2 rounded-xl text-xs hover:bg-slate-200 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        disabled={saving}
                        type="submit"
                        className="flex-1 bg-indigo-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        {isEdit ? 'Guardar cambios' : 'Guardar formación'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
