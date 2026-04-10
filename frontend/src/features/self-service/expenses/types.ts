export interface Expense {
    id: string;
    date: string;
    amount: number;
    category: string;
    description: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    paymentMethod: 'CASH' | 'COMPANY_CARD';
    receiptUrl?: string;
    employee?: {
        name: string;
        firstName: string;
        lastName: string;
    };
}
