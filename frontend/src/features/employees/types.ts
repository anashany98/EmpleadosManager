export interface Employee {
    id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    dni: string;
    subaccount465: string;
    department?: string;
    phone?: string;
    active: boolean;
}

export interface FilterState {
    department: string;
    status: 'all' | 'active' | 'inactive';
}

