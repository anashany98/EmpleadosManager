import { CheckCircle2, Clock, XCircle } from 'lucide-react';

export function ExpenseStatusBadge({ status }: { status: string }) {
    const styles = {
        PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
        APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
        REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800'
    };

    const icons = {
        PENDING: <Clock size={12} />,
        APPROVED: <CheckCircle2 size={12} />,
        REJECTED: <XCircle size={12} />
    };

    return (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 w-fit ${styles[status as keyof typeof styles]}`}>
            {icons[status as keyof typeof icons]}
            {status === 'PENDING' ? 'Pendiente' : status === 'APPROVED' ? 'Aprobado' : 'Rechazado'}
        </span>
    );
}
