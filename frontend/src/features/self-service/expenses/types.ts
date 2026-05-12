export interface Expense {
    id: string;
    date: string;
    amount: number;
    category: string;
    description?: string | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    paymentMethod: 'CASH' | 'COMPANY_CARD' | 'CARD' | 'PERSONAL_CARD' | 'TRANSFER';
    receiptUrl?: string;
    employee?: {
        name: string;
        firstName: string;
        lastName: string;
    };
}

export interface ExpenseEmployeeOption {
    id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    dni?: string;
}
