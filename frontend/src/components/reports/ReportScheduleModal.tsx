import { useState } from 'react';
import { X, Clock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';

interface ReportScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: string;
  reportName: string;
}

type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export default function ReportScheduleModal({ isOpen, onClose, reportType, reportName }: ReportScheduleModalProps) {
  const [name, setName] = useState(`${reportName} - Programado`);
  const [frequency, setFrequency] = useState<Frequency>('WEEKLY');
  const [sendEmail, setSendEmail] = useState(false);
  const [recipients, setRecipients] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/report-schedules/schedules', {
        name,
        reportType: reportType.toLowerCase().replace('_', '-'),
        params: JSON.stringify({}),
        frequency,
        sendEmail,
        recipients: JSON.stringify(recipients.split(',').map(r => r.trim()).filter(Boolean))
      });
      toast.success('Reporte programado exitosamente');
      onClose();
    } catch {
      toast.error('Error al programar el reporte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Programar Reporte</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-2">
              <Clock size={16} />
              Frecuencia
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
            >
              <option value="DAILY">Diario</option>
              <option value="WEEKLY">Semanal</option>
              <option value="MONTHLY">Mensual</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="rounded border-slate-300"
              />
              <Mail size={16} />
              <span className="text-sm">Enviar por email</span>
            </label>
          </div>

          {sendEmail && (
            <div>
              <label className="block text-sm font-medium mb-1">Destinatarios (separados por coma)</label>
              <input
                type="text"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="email1@ejemplo.com, email2@ejemplo.com"
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Programando...' : 'Programar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}