import { useState, useEffect } from 'react';
import { FileText, Download, Loader2, Search } from 'lucide-react';
import { api } from '../../api/client';
import { toast } from 'sonner';

interface MyPayslipsWidgetProps {
    employeeId: string;
}

export default function MyPayslipsWidget({ employeeId }: MyPayslipsWidgetProps) {
    const [payrolls, setPayrolls] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    useEffect(() => {
        if (employeeId) {
            fetchPayrolls();
        }
    }, [employeeId]);

    const fetchPayrolls = async () => {
        try {
            const res = await api.get(`/payroll/employee/${employeeId}`);
            setPayrolls(res.data || []);
        } catch (error) {
            console.error('Error fetching payrolls:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (payroll: any) => {
        setDownloadingId(payroll.id);
        try {
            const res = await api.get(`/payroll/${payroll.id}/pdf`, { responseType: 'blob' });

            // Create blob link to download
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            const filename = `Nomina_${payroll.batch.month}_${payroll.batch.year}.pdf`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success('Nómina descargada correctamente');
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Error al descargar la nómina');
        } finally {
            setDownloadingId(null);
        }
    };

    const getMonthName = (month: number) => {
        return new Date(2000, month - 1, 1).toLocaleString('es-ES', { month: 'long' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <FileText className="text-blue-600 dark:text-blue-400" size={18} />
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Mis Nóminas</h3>
                </div>
                <div className="text-xs text-slate-500">
                    {payrolls.length} disponibles
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-0">
                {payrolls.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                        <Search size={32} className="opacity-20" />
                        <p className="text-sm">No tienes nóminas disponibles</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/20 text-slate-500 sticky top-0 backdrop-blur-sm z-10">
                            <tr>
                                <th className="px-4 py-3 font-medium">Periodo</th>
                                <th className="px-4 py-3 font-medium text-right">Neto a Percibir</th>
                                <th className="px-4 py-3 font-medium text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {payrolls.map((payroll) => (
                                <tr key={payroll.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-slate-900 dark:text-slate-200 capitalize">
                                            {getMonthName(payroll.batch.month)} {payroll.batch.year}
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                            Emitida el {new Date(payroll.createdAt || Date.now()).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                            {Number(payroll.neto).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleDownload(payroll)}
                                            disabled={downloadingId === payroll.id}
                                            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400 rounded-lg transition-colors inline-flex items-center justify-center disabled:opacity-50"
                                            title="Descargar PDF"
                                        >
                                            {downloadingId === payroll.id ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <Download size={16} />
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
