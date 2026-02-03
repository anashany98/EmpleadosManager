import { PayrollRow } from '@prisma/client';

interface ValidationResult {
    rowId: string;
    status: 'OK' | 'WARNING' | 'ERROR';
    messages: string[];
}

export class ValidationService {
    static validateRows(rows: PayrollRow[]): ValidationResult[] {
        return rows.map(row => {
            const messages: string[] = [];
            let status: 'OK' | 'WARNING' | 'ERROR' = 'OK';

            // 1. Identificación
            if (!row.employeeId) {
                status = 'WARNING';
                messages.push('Empleado no identificado (sin DNI asociado)');
            }

            // 2. Integridad Numérica
            const debe = Number(row.bruto) + Number(row.ssEmpresa);
            const haber = Number(row.neto) + Number(row.irpf) + Number(row.ssTrabajador) + Number(row.ssEmpresa);
            // Nota: SS Empresa entra y sale si se paga a TGSS directo? 
            // Asiento típico:
            // (640) Bruto
            // (642) SS Empresa
            // a (476) SS Total (Empresa + Trab)
            // a (4751) IRPF
            // a (465) Neto

            const asientoDebe = Number(row.bruto) + Number(row.ssEmpresa);
            const asientoHaber = (Number(row.ssEmpresa) + Number(row.ssTrabajador)) + Number(row.irpf) + Number(row.neto);

            if (Math.abs(asientoDebe - asientoHaber) > 0.05) {
                status = 'ERROR';
                messages.push(`Descuadre contable: Debe ${asientoDebe.toFixed(2)} vs Haber ${asientoHaber.toFixed(2)}`);
            }

            if (Number(row.neto) < 0) {
                status = 'ERROR';
                messages.push('El neto no puede ser negativo');
            }

            return { rowId: row.id, status, messages };
        });
    }
}
