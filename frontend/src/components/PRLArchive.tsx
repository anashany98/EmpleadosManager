import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Stethoscope, GraduationCap, Plus, Calendar, Trash2, Check, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { useConfirm } from '../context/ConfirmContext';

export default function PRLArchive({ employeeId }: { employeeId: string }) {
    const confirmAction = useConfirm();
    const [reviews, setReviews] = useState<any[]>([]);
    const [trainings, setTrainings] = useState<any[]>([]);
    const [assets, setAssets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form states
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [showTrainingForm, setShowTrainingForm] = useState(false);
    const [showAssetForm, setShowAssetForm] = useState(false);

    // Review form
    const [revDate, setRevDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [revResult, setRevResult] = useState('APTO');
    const [revNext, setRevNext] = useState('');

    // Training form
    const [trName, setTrName] = useState('');
    const [trType, setTrType] = useState('PRL');
    const [trDate, setTrDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [trHours, setTrHours] = useState('');

    // Asset/EPI form
    const [asName, setAsName] = useState('');
    const [asSize, setAsSize] = useState('');
    const [asDate, setAsDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    useEffect(() => {
        fetchData();
    }, [employeeId]);

    const fetchData = async () => {
        try {
            const [revs, trains, asRes] = await Promise.all([
                api.get(`/employees/${employeeId}/medical-reviews`),
                api.get(`/employees/${employeeId}/trainings`),
                api.get(`/assets?employeeId=${employeeId}`)
            ]);
            setReviews(revs.data || revs || []);
            setTrainings(trains.data || trains || []);
            setAssets(asRes.data || asRes || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post(`/employees/${employeeId}/medical-reviews`, {
                date: revDate,
                result: revResult,
                nextReviewDate: revNext || null
            });
            toast.success('Revisión médica añadida');
            setShowReviewForm(false);
            fetchData();
        } catch (error) {
            toast.error('Error al guardar la revisión');
        } finally {
            setSaving(false);
        }
    };

    const handleSubmitTraining = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trName) return toast.error('El nombre del curso es obligatorio');
        setSaving(true);
        try {
            await api.post(`/employees/${employeeId}/trainings`, {
                name: trName,
                type: trType,
                date: trDate,
                hours: trHours || null
            });
            toast.success('Formación añadida');
            setShowTrainingForm(false);
            setTrName('');
            setTrHours('');
            fetchData();
        } catch (error) {
            toast.error('Error al guardar la formación');
        } finally {
            setSaving(false);
        }
    };

    const handleSubmitAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!asName) return toast.error('El nombre del material es obligatorio');
        setSaving(true);
        try {
            await api.post(`/assets`, {
                employeeId,
                name: asName,
                category: 'EPI',
                size: asSize || null,
                assignedDate: asDate
            });
            toast.success('Material registrado');
            setShowAssetForm(false);
            setAsName('');
            setAsSize('');
            fetchData();
        } catch (error) {
            toast.error('Error al guardar el material');
        } finally {
            setSaving(false);
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
            fetchData();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const handleDeleteAsset = async (id: string) => {
        const ok = await confirmAction({
            title: 'Eliminar Registro de Material',
            message: '¿Estás seguro de eliminar este registro?',
            confirmText: 'Eliminar',
            type: 'danger'
        });

        if (!ok) return;
        try {
            await api.delete(`/assets/${id}`);
            fetchData();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

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
                        onClick={() => setShowReviewForm(!showReviewForm)}
                        className={`p-1.5 rounded-lg transition-all ${showReviewForm ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 hover:bg-rose-100'}`}
                    >
                        {showReviewForm ? <X size={20} /> : <Plus size={20} />}
                    </button>
                </div>

                {showReviewForm && (
                    <form onSubmit={handleSubmitReview} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Revisión</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs"
                                    value={revDate}
                                    onChange={(e) => setRevDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Resultado</label>
                                <select
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs"
                                    value={revResult}
                                    onChange={(e) => setRevResult(e.target.value)}
                                >
                                    <option value="APTO">APTO</option>
                                    <option value="NO APTO">NO APTO</option>
                                    <option value="APTO CON LIMITACIONES">APTO CON LIMITACIONES</option>
                                    <option value="PENDIENTE">PENDIENTE</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Próxima Revisión (Opcional)</label>
                            <input
                                type="date"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs"
                                value={revNext}
                                onChange={(e) => setRevNext(e.target.value)}
                            />
                        </div>
                        <button
                            disabled={saving}
                            type="submit"
                            className="w-full bg-rose-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-rose-700 transition-colors"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            Guardar Revisión
                        </button>
                    </form>
                )}

                <div className="space-y-4">
                    {reviews.length > 0 ? reviews.map(rev => (
                        <div key={rev.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex justify-between items-center group">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 dark:text-white">{format(new Date(rev.date), 'dd/MM/yyyy')}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rev.result === 'APTO' ? 'bg-emerald-500' :
                                        rev.result === 'NO APTO' ? 'bg-rose-500' : 'bg-amber-500'
                                        } text-white`}>
                                        {rev.result}
                                    </span>
                                </div>
                                {rev.nextReviewDate && (
                                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                        <Calendar size={10} /> Próxima: {format(new Date(rev.nextReviewDate), 'dd/MM/yyyy')}
                                    </p>
                                )}
                            </div>
                            <button onClick={() => handleDeleteReview(rev.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1">
                                <Trash2 size={14} />
                            </button>
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
                        onClick={() => setShowTrainingForm(!showTrainingForm)}
                        className={`p-1.5 rounded-lg transition-all ${showTrainingForm ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-100'}`}
                    >
                        {showTrainingForm ? <X size={20} /> : <Plus size={20} />}
                    </button>
                </div>

                {showTrainingForm && (
                    <form onSubmit={handleSubmitTraining} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre del Curso</label>
                            <input
                                type="text"
                                required
                                placeholder="Ej: PRL 20h Construcción"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs"
                                value={trName}
                                onChange={(e) => setTrName(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo</label>
                                <select
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs"
                                    value={trType}
                                    onChange={(e) => setTrType(e.target.value)}
                                >
                                    <option value="PRL">PRL</option>
                                    <option value="TECNICA">TÉCNICA</option>
                                    <option value="HABILIDADES">HABILIDADES</option>
                                    <option value="OTROS">OTROS</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs"
                                    value={trDate}
                                    onChange={(e) => setTrDate(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Horas (Opcional)</label>
                            <input
                                type="number"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs"
                                value={trHours}
                                onChange={(e) => setTrHours(e.target.value)}
                            />
                        </div>
                        <button
                            disabled={saving}
                            type="submit"
                            className="w-full bg-indigo-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            Guardar Formación
                        </button>
                    </form>
                )}

                <div className="space-y-4">
                    {trainings.length > 0 ? trainings.map(tr => (
                        <div key={tr.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex justify-between items-center group">
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{tr.name}</h4>
                                <div className="flex items-center gap-3 mt-1 text-[10px]">
                                    <span className="font-bold text-slate-400 uppercase">{tr.type}</span>
                                    <span className="text-slate-500 flex items-center gap-1">
                                        <Calendar size={10} /> {format(new Date(tr.date), 'dd/MM/yyyy')}
                                    </span>
                                    {tr.hours && (tr.hours > 0 && <span className="text-indigo-600 font-bold">{tr.hours}h</span>)}
                                </div>
                            </div>
                            <button onClick={() => handleDeleteTraining(tr.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )) : (
                        <p className="text-sm text-slate-400 italic py-4">No hay cursos registrados</p>
                    )}
                </div>
            </div>

            {/* Entrega de EPIS y Material */}
            <div className="lg:col-span-2 space-y-6 pt-8 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Plus className="text-emerald-600" size={24} /> Entrega de EPIS y Equipamiento
                    </h3>
                    <button
                        onClick={() => setShowAssetForm(!showAssetForm)}
                        className={`p-1.5 rounded-lg transition-all ${showAssetForm ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-100'}`}
                    >
                        {showAssetForm ? <X size={20} /> : <Plus size={20} />}
                    </button>
                </div>

                {showAssetForm && (
                    <form onSubmit={handleSubmitAsset} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Material / EPI</label>
                            <input
                                type="text"
                                required
                                placeholder="Ej: Botas de seguridad"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs"
                                value={asName}
                                onChange={(e) => setAsName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Talla / Modelo</label>
                            <input
                                type="text"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs"
                                value={asSize}
                                onChange={(e) => setAsSize(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Entrega</label>
                            <input
                                type="date"
                                required
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs"
                                value={asDate}
                                onChange={(e) => setAsDate(e.target.value)}
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                disabled={saving}
                                type="submit"
                                className="w-full bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors h-[38px]"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                Registrar Entrega
                            </button>
                        </div>
                    </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assets.length > 0 ? assets.map(asset => (
                        <div key={asset.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex justify-between items-center group">
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{asset.name}</h4>
                                <div className="flex items-center gap-3 mt-1 text-[10px]">
                                    {asset.size && <span className="font-bold text-emerald-600">Talla: {asset.size}</span>}
                                    <span className="text-slate-500 flex items-center gap-1">
                                        <Calendar size={10} /> {asset.assignedDate ? format(new Date(asset.assignedDate), 'dd/MM/yyyy') : '-'}
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => handleDeleteAsset(asset.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )) : (
                        <p className="text-sm text-slate-400 italic py-4 col-span-full text-center">No hay registros de equipamiento</p>
                    )}
                </div>
            </div>
        </div>
    );
}
