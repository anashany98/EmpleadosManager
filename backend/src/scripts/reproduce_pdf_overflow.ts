
import fs from 'fs';
import { PayrollPdfService } from '../services/PayrollPdfService';
import { Response } from 'express';

const mockPayrollData: any = {
    id: 'test-payroll-id',
    month: 1,
    year: 2024,
    bruto: 2000,
    neto: 1600,
    irpf: 300,
    ssEmpresa: 500,
    ssTrabajador: 100,
    company: {
        name: 'Test Company S.L.',
        cif: 'B12345678',
        address: 'Calle Test 123',
        city: 'Madrid',
        postalCode: '28001'
    },
    employee: {
        name: 'Juan Perez',
        dni: '12345678A',
        socialSecurityNumber: 'SS1234567890',
        jobTitle: 'Developer',
        category: 'Senior',
        seniorityDate: new Date('2020-01-01')
    },
    items: []
};

// Add many items to force overflow
for (let i = 0; i < 50; i++) {
    mockPayrollData.items.push({
        concept: `Concepto Extra ${i + 1}`,
        amount: 10 + i,
        type: i % 2 === 0 ? 'EARNING' : 'DEDUCTION'
    });
}

async function run() {
    console.log('Starting PDF generation OVERFLOW test...');
    try {
        const buffer = await PayrollPdfService.generate({} as Response, mockPayrollData);
        console.log('PDF generated successfully!');
        console.log('Buffer size:', buffer.length);
        fs.writeFileSync('reproduction_overflow.pdf', buffer);
        console.log('Saved to reproduction_overflow.pdf');
    } catch (error) {
        console.error('Error generating PDF:', error);
    }
}

run();
