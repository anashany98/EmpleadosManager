import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { Settings, DollarSign, Upload, AlertCircle } from 'lucide-react';

const CATEGORIAS = ['Grupo 1', 'Grupo 2', 'Grupo 3', 'Grupo 4', 'Grupo 5', 'Grupo 6', 'Grupo 7', 'Oficial de 1ª', 'Oficial de 2ª', 'Oficial de 3ª', 'Peón', 'Otros'];

export default function SettingsPage() {
    const [rates, setRates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        fetchRates();
    }, []);

    const fetchRates = async () => {
        try {
            const data = await api.get('/overtime/rates');
            setRates(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateRate = async (category: string, normal: number, holiday: number) => {
        try {
            await api.post('/overtime/rates', { category, overtimeRate: normal, holidayOvertimeRate: holiday });
            toast.success(`Tarifas de ${category} actualizadas`);
            fetchRates();
        } catch (error) {
            toast.error('Error al actualizar tarifas');
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const result = await api.post('/overtime/import', formData);

            // Mostrar resultado principal
            toast.success(result.message || `${result.imported || 0} registros importados`);

            // Mostrar errores si los hay
            if (result.errors?.length > 0) {
                console.error('❌ Errores de importación:', result.errors);
                toast.error(`${result.errors.length} filas con errores. Revisa la consola para más detalles.`, {
                    duration: 5000
                });
                // Mostrar primeros 3 errores
                result.errors.slice(0, 3).forEach((err: string) => {
                    toast.error(err, { duration: 4000 });
                });
            }

            // Mostrar info de filas saltadas
            if (result.skipped?.length > 0) {
                console.info('ℹ️ Filas saltadas:', result.skipped);
                toast.info(`${result.skipped.length} filas saltadas (sin horas extras o datos vacíos)`, {
                    duration: 3000
                });
            }
        } catch (error: any) {
            console.error('Error en importación:', error);
            toast.error('Error importando el archivo. Revisa la consola para más detalles.');
        } finally {
            setImporting(false);
            if (e.target) e.target.value = '';
        }
    };

    if (loading) return <div className="p-10 text-center animate-pulse">Cargando configuración...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-600 rounded-lg text-white">
                    <Settings size={24} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Configuración del Sistema</h1>
                    <p className="text-slate-500">Gestiona las tarifas y preferencias globales</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center gap-3">
                    <DollarSign className="text-blue-500" size={20} />
                    <h2 className="font-bold text-slate-900 dark:text-white text-lg">Tarifas de Horas Extras por Categoría</h2>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {CATEGORIAS.map(cat => {
                            const rate = rates.find(r => r.category === cat);
                            return (
                                <div key={cat} className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                                    <label className="text-sm font-black text-slate-900 dark:text-white border-l-4 border-blue-500 pl-3 block">{cat}</label>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Día Normal</span>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    defaultValue={rate?.overtimeRate || 0}
                                                    onBlur={(e) => handleUpdateRate(cat, parseFloat(e.target.value), rate?.holidayOvertimeRate || 0)}
                                                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 font-bold text-blue-600 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                />
                                                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">€</div>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-amber-500 uppercase">Festivo / Finde</span>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    defaultValue={rate?.holidayOvertimeRate || 0}
                                                    onBlur={(e) => handleUpdateRate(cat, rate?.overtimeRate || 0, parseFloat(e.target.value))}
                                                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-amber-50/20 dark:bg-amber-900/10 font-bold text-amber-600 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                                />
                                                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-amber-400 text-[10px] font-bold">€</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Importador de Horas Extras */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Upload className="text-indigo-500" size={20} />
                        <h2 className="font-bold text-slate-900 dark:text-white text-lg">Importador de Horas de Fichaje</h2>
                    </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                            Sube el archivo Excel exportado de tu sistema de fichajes. El sistema identificará a los empleados por su <b>DNI</b> y registrará las horas de la columna <b>Extr</b>.
                        </p>
                        <div className="flex gap-4">
                            <label className={`
                                flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all
                                ${importing ? 'opacity-50 cursor-wait' : 'hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800'}
                                border-slate-200 dark:border-slate-700
                            `}>
                                <Upload className={`mb-2 ${importing ? 'animate-bounce text-indigo-500' : 'text-slate-400'}`} size={32} />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    {importing ? 'Procesando archivo...' : 'Seleccionar Excel de Fichajes'}
                                </span>
                                <p className="text-xs text-slate-400 mt-1">Formato .xlsx o .xls</p>
                                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImport} disabled={importing} />
                            </label>
                        </div>
                    </div>

                    <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-sm">
                            <AlertCircle size={18} />
                            <span>Requisitos del Excel</span>
                        </div>
                        <ul className="text-sm text-blue-600/80 dark:text-blue-400/70 space-y-2">
                            <li className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-blue-400 rounded-full" />
                                Columna <b>DNI</b> para identificar al empleado
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-blue-400 rounded-full" />
                                Columna <b>Fecha</b> (formato día/mes/año)
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-blue-400 rounded-full" />
                                Columna <b>Extr</b> para las horas extras
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-blue-400 rounded-full" />
                                Máximo 5MB por archivo
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-8 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-xl shadow-blue-500/20">
                    <h3 className="text-xl font-bold mb-2">Próximas Funciones</h3>
                    <ul className="space-y-2 opacity-90 text-sm">
                        <li>• Configuración de conceptos contables</li>
                        <li>• Personalización de plantillas de Excel</li>
                        <li>• Gestión de usuarios y permisos</li>
                        <li>• Notificaciones automáticas</li>
                    </ul>
                </div>

                <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white text-lg">Ayuda</h3>
                    <p className="text-slate-500 text-sm">
                        Los precios establecidos aquí se aplicarán automáticamente en el calculador de horas extras de la ficha de cada empleado según su categoría asignada.
                    </p>
                </div>
            </div>
        </div>
    );
}
