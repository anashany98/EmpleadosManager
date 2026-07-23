import { prisma } from '../lib/prisma';
import { OBRA_EXPENSE_TYPES, type ObraExpenseType } from '../../../shared/obras';

export const ObraImportService = {
    OBRA_EXPENSE_TYPES,

    parseExcelDate(raw: unknown): Date | null {
        if (raw == null || raw === '') return null;
        if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
        if (typeof raw === 'number') {
            const ms = (raw - 25569) * 86400 * 1000;
            const d = new Date(ms);
            return isNaN(d.getTime()) ? null : d;
        }
        const s = String(raw).trim();
        const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
        if (m) {
            const dd = Number(m[1]);
            const mm = Number(m[2]) - 1;
            let yyyy = Number(m[3]);
            if (yyyy < 100) yyyy += 2000;
            const d = new Date(Date.UTC(yyyy, mm, dd));
            return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    },

    parseAmount(raw: unknown): number | null {
        const n = Number(typeof raw === 'string' ? raw.replace(',', '.').trim() : raw);
        if (!Number.isFinite(n) || n <= 0) return null;
        return Math.round(n * 100) / 100;
    },

    async validate(rows: Record<string, any>[], rules: Record<string, string>): Promise<{
        valid: Array<{ rowIndex: number; raw: Record<string, any>; warnings: string[]; data?: {
            obraId: string;
            employeeId: string | null;
            type: ObraExpenseType;
            date: Date;
            amount: number;
            currency: string;
            description: string | null;
            vendor: string | null;
            reference: string | null;
            origin: string | null;
            destination: string | null;
        } }>;
        invalid: Array<{ rowIndex: number; raw: Record<string, any>; warnings: string[]; obraCode?: string | null; employeeDni?: string | null }>;
    }> {
        const obraCodeHeader = rules.obra_code;
        const employeeDniHeader = rules.employee_dni;
        const typeHeader = rules.type;
        const dateHeader = rules.date;
        const amountHeader = rules.amount;

        // --- C1: Pre-load all obras and employees in 2 queries (avoid N+1) ---
        const allObraCodes = new Set<string>();
        const allDnis = new Set<string>();
        for (const row of rows) {
            const r = row || {};
            if (obraCodeHeader && r[obraCodeHeader]) {
                const code = String(r[obraCodeHeader]).trim();
                if (code) allObraCodes.add(code);
            }
            if (employeeDniHeader && r[employeeDniHeader]) {
                const dni = String(r[employeeDniHeader]).trim();
                if (dni) allDnis.add(dni);
            }
        }

        const [obras, employees] = await Promise.all([
            allObraCodes.size > 0
                ? prisma.project.findMany({ where: { code: { in: [...allObraCodes] } }, select: { id: true, code: true, status: true } })
                : [],
            allDnis.size > 0
                ? prisma.employee.findMany({ where: { dni: { in: [...allDnis] } }, select: { id: true, dni: true } })
                : []
        ]);
        const obraByCode = new Map(obras.map(o => [o.code, o]));
        const empByDni = new Map(employees.map(e => [e.dni, e]));

        const valid: any[] = [];
        const invalid: any[] = [];

        for (let i = 0; i < rows.length; i++) {
            const raw = rows[i] || {};
            const rowIndex = i + 2;
            const warnings: string[] = [];

            const obraCode = (obraCodeHeader && raw[obraCodeHeader]) ? String(raw[obraCodeHeader]).trim() : '';
            const typeRaw = (typeHeader && raw[typeHeader]) ? String(raw[typeHeader]).trim().toUpperCase() : '';
            const date = this.parseExcelDate(dateHeader ? raw[dateHeader] : null);
            const amount = this.parseAmount(amountHeader ? raw[amountHeader] : null);

            if (!obraCode) warnings.push('MISSING_OBRA_CODE');
            if (!typeRaw || !(OBRA_EXPENSE_TYPES as readonly string[]).includes(typeRaw)) {
                warnings.push('INVALID_TYPE');
            }
            if (!date) warnings.push('INVALID_DATE');
            if (amount == null) warnings.push('INVALID_AMOUNT');

            if (warnings.length > 0) {
                invalid.push({ rowIndex, raw, warnings, obraCode: obraCode || null, employeeDni: employeeDniHeader ? String(raw[employeeDniHeader] || '').trim() || null : null });
                continue;
            }

            const obra = obraCode ? obraByCode.get(obraCode) || null : null;

            if (!obra) {
                invalid.push({
                    rowIndex,
                    raw,
                    warnings: obraCode ? ['OBRA_NOT_FOUND'] : ['MISSING_OBRA_CODE'],
                    obraCode: obraCode || null,
                    employeeDni: employeeDniHeader ? String(raw[employeeDniHeader] || '').trim() || null : null
                });
                continue;
            }
            if (obra.status !== 'ACTIVE') {
                invalid.push({
                    rowIndex,
                    raw,
                    warnings: ['OBRA_INACTIVE'],
                    obraCode: obraCode || null,
                    employeeDni: employeeDniHeader ? String(raw[employeeDniHeader] || '').trim() || null : null
                });
                continue;
            }

            let employeeId: string | null = null;
            if (employeeDniHeader && raw[employeeDniHeader]) {
                const dni = String(raw[employeeDniHeader]).trim();
                if (dni) {
                    const emp = empByDni.get(dni) || null;
                    if (emp) employeeId = emp.id;
                    else warnings.push('EMPLOYEE_NOT_FOUND');
                }
            }

            // --- C6: optStr must respect rules mapping ---
            const optStr = (ruleKey: string): string | null => {
                const header = rules[ruleKey];
                if (!header || !raw[header]) return null;
                const v = String(raw[header]).trim();
                return v === '' ? null : v.slice(0, 500);
            };

            valid.push({
                rowIndex,
                raw,
                warnings,
                data: {
                    obraId: obra.id,
                    employeeId,
                    type: typeRaw as ObraExpenseType,
                    date: date!,
                    amount: amount!,
                    // --- C7: Read currency from mapping, default 'EUR' only if no column ---
                    currency: optStr('currency') || 'EUR',
                    description: optStr('description'),
                    vendor: optStr('vendor'),
                    reference: optStr('reference'),
                    origin: optStr('origin'),
                    destination: optStr('destination')
                }
            });
        }

        return { valid, invalid };
    }
};
