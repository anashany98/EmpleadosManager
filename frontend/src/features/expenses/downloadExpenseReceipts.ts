import { api } from '../../api/client';

export async function downloadExpenseReceipts(expenseIds: string[]) {
    const blob = await api.post<Blob>('/obra-expenses/receipts', {
        expenseIds
    }, { responseType: 'blob' });
    const filename = expenseIds.length === 1 ? 'recibi-gasto.pdf' : 'recibis-gastos.zip';
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}
