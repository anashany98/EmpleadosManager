
import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { FileText, Download, Euro, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface PayrollRow {
    id: string;
    bruto: number;
    neto: number;
    ssEmpresa: number;
    ssTrabajador: number;
    irpf: number;
    batch: {
        year: number;
        month: number;
    };
    items?: any[];
}

export default function EmployeePayrollViewer({ employeeId }: { employeeId: string }) {
    const [payrolls, setPayrolls] = useState<PayrollRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedPayroll, setSelectedPayroll] = useState<PayrollRow | null>(null);
    const [newPayroll, setNewPayroll] = useState({
        month: '',
        year: new Date().getFullYear().toString(),
        bruto: '',
        neto: ''
    });

    useEffect(() => {
        fetchPayrolls();
    }, [employeeId]);

    const fetchPayrolls = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/payroll/employee/${employeeId}`);
            setPayrolls(res.data || []);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar nóminas');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateManual = async () => {
        try {
            if (!newPayroll.month || !newPayroll.year || !newPayroll.bruto || !newPayroll.neto) {
                toast.error('Por favor rellena todos los campos');
                return;
            }

            await api.post('/payroll/manual', {
                employeeId,
                month: parseInt(newPayroll.month),
                year: parseInt(newPayroll.year),
                bruto: parseFloat(newPayroll.bruto),
                neto: parseFloat(newPayroll.neto)
            });

            toast.success('Nómina creada correctamente');
            setShowCreateModal(false);
            setNewPayroll({ month: '', year: new Date().getFullYear().toString(), bruto: '', neto: '' });
            fetchPayrolls();
        } catch (error) {
            console.error(error);
            toast.error('Error al crear nómina');
        }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);

    const getMonthName = (month: number) => {
        return new Date(2000, month - 1, 1).toLocaleString('es-ES', { month: 'long' });
    };

    if (loading) return <div className="p-8 text-center animate-pulse text-slate-500">Cargando nóminas...</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText size={20} className="text-blue-500" /> Historial de Nóminas
                </h3>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    <Plus size={16} /> Añadir Nómina
                </button>
            </div>

            {payrolls.length === 0 ? (
                <div className="p-12 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                    <FileText className="mx-auto text-slate-400 mb-4" size={48} />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">Sin nóminas registradas</h3>
                    <p className="text-slate-500 text-sm mt-1">Este empleado no tiene nóminas asociadas todavía.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {payrolls.map((payroll) => (
                        <div key={payroll.id} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row items-center justify-between gap-6">

                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 p-3 rounded-lg font-bold text-center min-w-[60px]">
                                    <div className="text-xs uppercase tracking-wider">{getMonthName(payroll.batch.month).slice(0, 3)}</div>
                                    <div className="text-lg">{payroll.batch.year}</div>
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white capitalize">
                                        Nómina {getMonthName(payroll.batch.month)} {payroll.batch.year}
                                    </h4>
                                    <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                                        <span className="flex items-center gap-1">
                                            <Euro size={14} /> Bruto: {formatCurrency(payroll.bruto)}
                                        </span>
                                        <span className="flex items-center gap-1 text-green-600 font-medium">
                                            <Euro size={14} /> Neto: {formatCurrency(payroll.neto)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Breakdown Preview (Concepts) */}
                            <div className="flex-1 hidden md:block border-l border-slate-100 dark:border-slate-700 pl-6">
                                {payroll.items && payroll.items.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {payroll.items.slice(0, 3).map((item: any, idx: number) => (
                                            <span key={idx} className={`text-xs px-2 py-1 rounded border ${item.type === 'EARNING' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                                {item.concept}
                                            </span>
                                        ))}
                                        {payroll.items.length > 3 && (
                                            <span className="text-xs px-2 py-1 rounded bg-slate-50 text-slate-500 border border-slate-100">+{payroll.items.length - 3} más</span>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-xs text-slate-400 italic">Sin desglose detallado</span>
                                )}
                            </div>

                            <div className="flex gap-2 w-full md:w-auto">
                                <button
                                    onClick={() => setSelectedPayroll(payroll)}
                                    className="flex-1 md:flex-none px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors"
                                >
                                    Ver Detalle
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            toast.info('Generando PDF...');
                                            const res = await api.get(`/payroll/${payroll.id}/pdf`, { responseType: 'blob' });

                                            // Check if response is actually a JSON error
                                            if (res.type === 'application/json') {
                                                const text = await res.text();
                                                const json = JSON.parse(text);
                                                throw new Error(json.message || 'Error al generar PDF');
                                            }

                                            const url = window.URL.createObjectURL(new Blob([res]));
                                            const link = document.createElement('a');
                                            link.href = url;
                                            link.setAttribute('download', `Nomina_${payroll.batch.month}_${payroll.batch.year}.pdf`);
                                            document.body.appendChild(link);
                                            link.click();
                                            link.parentNode?.removeChild(link);
                                            window.URL.revokeObjectURL(url);
                                            toast.success('PDF descargado');
                                        } catch (error: any) {
                                            console.error('PDF Download Error:', error);
                                            toast.error(error.message || 'Error al descargar PDF');
                                        }
                                    }}
                                    className="flex-1 md:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Download size={16} /> PDF
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Añadir Nómina Manual</h3>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Mes</label>
                                    <select
                                        value={newPayroll.month}
                                        onChange={e => setNewPayroll({ ...newPayroll, month: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                    >
                                        <option value="">Seleccionar...</option>
                                        {Array.from({ length: 12 }, (_, i) => (
                                            <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString('es-ES', { month: 'long' })}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Año</label>
                                    <input
                                        type="number"
                                        value={newPayroll.year}
                                        onChange={e => setNewPayroll({ ...newPayroll, year: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-slate-500 mb-1 block">Salario Bruto (€)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={newPayroll.bruto}
                                    onChange={e => setNewPayroll({ ...newPayroll, bruto: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium text-slate-500 mb-1 block">Salario Neto (€)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={newPayroll.neto}
                                    onChange={e => setNewPayroll({ ...newPayroll, neto: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateManual}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedPayroll && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Desglose de Nómina</h3>
                                <p className="text-sm text-slate-500 capitalize">
                                    {getMonthName(selectedPayroll.batch.month)} {selectedPayroll.batch.year}
                                </p>
                            </div>
                            <button onClick={() => setSelectedPayroll(null)} className="text-slate-400 hover:text-slate-600">×</button>
                        </div>

                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                    <div className="text-sm text-slate-500 mb-1">Total Devengado</div>
                                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(selectedPayroll.bruto)}</div>
                                </div>
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl">
                                    <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Líquido a Percibir</div>
                                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(selectedPayroll.neto)}</div>
                                </div>
                            </div>

                            {/* Deductions Breakdown */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-medium text-slate-900 dark:text-white border-b pb-2">Deducciones y Aportaciones</h4>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">SS Empresa</span>
                                    <span className="font-medium">{formatCurrency(selectedPayroll.ssEmpresa)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">SS Trabajador</span>
                                    <span className="font-medium text-red-600">-{formatCurrency(selectedPayroll.ssTrabajador)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">IRPF</span>
                                    <span className="font-medium text-red-600">-{formatCurrency(selectedPayroll.irpf)}</span>
                                </div>
                            </div>

                            {/* Detailed Items Table */}
                            {selectedPayroll.items && selectedPayroll.items.length > 0 ? (
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                                            <tr>
                                                <th className="px-4 py-2 text-left font-medium">Concepto</th>
                                                <th className="px-4 py-2 text-right font-medium">Importe</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                            {selectedPayroll.items.map((item: any, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full ${item.type === 'EARNING' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                            {item.concept}
                                                        </div>
                                                    </td>
                                                    <td className={`px-4 py-2 text-right font-medium ${item.type === 'EARNING' ? 'text-green-600' : 'text-red-600'}`}>
                                                        {item.type === 'EARNING' ? '+' : '-'}{formatCurrency(item.amount)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center p-4 bg-slate-50 rounded-lg text-slate-500 text-sm italic">
                                    No hay detalle de conceptos disponible para esta nómina.
                                </div>
                            )}

                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={() => setSelectedPayroll(null)}
                                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
