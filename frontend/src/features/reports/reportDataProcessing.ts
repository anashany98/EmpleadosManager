import type { ReportType, SummaryCardData } from './reportTypes';
import { getAttendanceWindow, formatCurrency, formatNumber, formatPercent, formatDate } from './reportHelpers';

export function buildRequestParams(activeTab: ReportType, filters: Record<string, string>) {
    const params: Record<string, string> = {};

    if (filters.companyId) params.companyId = filters.companyId;
    if (filters.department && activeTab !== 'GENDER_GAP') params.department = filters.department;

    if (activeTab === 'ATTENDANCE' || activeTab === 'OVERTIME' || activeTab === 'ABSENCES_DETAILED') {
        params.start = filters.start;
        params.end = filters.end;
    } else if (activeTab === 'VACATIONS') {
        params.year = filters.year;
    } else if (activeTab === 'COSTS' || activeTab === 'KPIS') {
        params.year = filters.year;
        if (filters.month) params.month = filters.month;
    } else if (activeTab === 'GENDER_GAP') {
        params.year = filters.year;
    } else if (activeTab === 'OBRA_SUMMARY' || activeTab === 'OBRA_EMPLOYEES') {
        if (filters.status) params.status = filters.status;
        if (filters.start) params.from = filters.start;
        if (filters.end) params.to = filters.end;
    }

    return params;
}

export function getNormalizedRows(activeTab: ReportType, data: any) {
    if (activeTab === 'KPIS') {
        return (data?.deptStats || []).map((item: any) => ({
            department: item.department || 'Sin asignar',
            employees: item.employees || 0,
            absenceDays: item.absenceDays || 0,
            potentialDays: item.potentialDays || 0,
            rate: item.rate || 0
        }));
    }

    if (activeTab === 'GENDER_GAP') {
        return (data?.rows || []).map((item: any) => ({
            department: item.department || 'Sin asignar',
            maleCount: item.maleCount || 0,
            femaleCount: item.femaleCount || 0,
            maleAvg: item.maleAvg || 0,
            femaleAvg: item.femaleAvg || 0,
            gap: item.gap || 0
        }));
    }

    if (activeTab === 'OBRA_SUMMARY') {
        const rows = Array.isArray(data?.obras) ? data.obras : [];
        return rows.map((o: any) => {
            const totals: Record<string, number> = o.totals || {};
            const total = Object.values(totals).reduce((a, b) => Number(a) + Number(b), 0);
            const budget = Number(o.budget || 0);
            return {
                id: o.id,
                code: o.code,
                name: o.name,
                clientName: o.clientName || '-',
                status: o.status,
                perDiem: Number(totals.PER_DIEM || 0),
                lodging: Number(totals.LODGING || 0),
                flight: Number(totals.FLIGHT || 0),
                transport: Number(totals.TRANSPORT || 0),
                other: Number(totals.OTHER || 0),
                hours: Number(o.hours || 0),
                empleadosCount: Number(o.empleadosCount || 0),
                budget,
                total,
                pct: budget > 0 ? total / budget : 0
            };
        });
    }

    if (activeTab === 'OBRA_EMPLOYEES') {
        const rows = Array.isArray(data) ? data : [];
        return rows.map((r: any, idx: number) => ({
            idx,
            employee: r.employee || '-',
            obra: r.obra || '-',
            obraId: r.obraId || null,
            obraCode: r.obraCode || '',
            hours: Number(r.hours || 0),
            perDiem: Number(r.byType?.PER_DIEM || 0),
            lodging: Number(r.byType?.LODGING || 0),
            flight: Number(r.byType?.FLIGHT || 0),
            transport: Number(r.byType?.TRANSPORT || 0),
            other: Number(r.byType?.OTHER || 0),
            total: Number(r.total || 0)
        }));
    }

    const rows = Array.isArray(data) ? data : [];

    if (activeTab === 'ATTENDANCE') {
        return rows.map((item: any) => {
            const attendanceWindow = getAttendanceWindow(item.segments || []);
            return {
                employee: item.employeeName || 'N/A',
                dni: item.employeeDni || '-',
                department: item.department || 'Sin asignar',
                date: item.date,
                totalHours: item.totalHours || 0,
                status: item.status || 'INCOMPLETE',
                firstSegment: attendanceWindow.firstSegment,
                lastSegment: attendanceWindow.lastSegment,
                segmentsText: attendanceWindow.segmentsText
            };
        });
    }

    if (activeTab === 'OVERTIME') {
        return rows.map((item: any) => ({
            employee: item.employee?.name || 'N/A',
            dni: item.employee?.dni || '-',
            department: item.employee?.department || 'Sin asignar',
            date: item.date,
            hours: item.hours || 0,
            rate: item.rate || 0,
            totalCost: item.totalCost || 0,
            type: item.type || 'STANDARD'
        }));
    }

    if (activeTab === 'VACATIONS') {
        return rows.map((item: any) => ({
            employee: item.name,
            department: item.department || 'Sin asignar',
            totalQuota: item.totalQuota || 0,
            annualQuotaDays: item.annualQuotaDays || 0,
            carriedOverDays: item.carriedOverDays || 0,
            importedUsedDays: item.importedUsedDays || 0,
            approvedUsedDays: item.approvedUsedDays || 0,
            pendingDays: item.pendingDays || 0,
            usedDays: item.usedDays || 0,
            remainingDays: item.remainingDays || 0,
            projectedRemainingDays: item.projectedRemainingDays || item.remainingDays || 0,
            usageRate: item.totalQuota ? ((item.usedDays || 0) / item.totalQuota) * 100 : 0,
            requests: item.requests || item.vacations?.length || 0
        }));
    }

    if (activeTab === 'COSTS') {
        return rows.map((item: any) => ({
            employee: item.name,
            dni: item.dni || '-',
            department: item.department || 'Sin asignar',
            bruto: item.bruto || 0,
            ssEmpresa: item.ssEmpresa || 0,
            irpf: item.irpf || 0,
            neto: item.neto || 0,
            totalCost: item.totalCost || 0
        }));
    }

    return rows.map((item: any) => ({
        employee: item.employee?.name || 'N/A',
        dni: item.employee?.dni || '-',
        department: item.employee?.department || 'Sin asignar',
        startDate: item.startDate,
        endDate: item.endDate,
        days: item.days || 0,
        type: item.type || '-',
        reason: item.reason || '-'
    }));
}

export function buildSummaryCards(activeTab: ReportType, rows: any[], data: any): SummaryCardData[] {
    if (activeTab === 'ATTENDANCE') {
        const totalHours = rows.reduce((sum, row) => sum + (row.totalHours || 0), 0);
        return [
            { label: 'Jornadas', value: formatNumber(rows.length), helper: 'Días consolidados en el rango', tone: 'blue' },
            { label: 'Personas', value: formatNumber(new Set(rows.map((row) => row.employee)).size), helper: 'Empleados con marcajes', tone: 'blue' },
            { label: 'Horas', value: formatNumber(totalHours, ' h'), helper: 'Horas trabajadas acumuladas', tone: 'emerald' },
            { label: 'Incompletas', value: formatNumber(rows.filter((row) => row.status === 'INCOMPLETE').length), helper: 'Jornadas para revisar', tone: 'rose' }
        ];
    }

    if (activeTab === 'OVERTIME') {
        const totalHours = rows.reduce((sum, row) => sum + (row.hours || 0), 0);
        const totalCost = rows.reduce((sum, row) => sum + (row.totalCost || 0), 0);
        const averageRate = rows.length > 0 ? rows.reduce((sum, row) => sum + (row.rate || 0), 0) / rows.length : 0;
        return [
            { label: 'Registros', value: formatNumber(rows.length), helper: 'Apuntes de extra liquidados', tone: 'emerald' },
            { label: 'Horas', value: formatNumber(totalHours, ' h'), helper: 'Volumen total de extra', tone: 'emerald' },
            { label: 'Coste', value: formatCurrency(totalCost), helper: 'Impacto económico estimado', tone: 'violet' },
            { label: 'Tarifa media', value: formatCurrency(averageRate), helper: 'Precio medio por hora', tone: 'blue' }
        ];
    }

    if (activeTab === 'VACATIONS') {
        const totalQuota = rows.reduce((sum, row) => sum + (row.totalQuota || 0), 0);
        const carryOverDays = rows.reduce((sum, row) => sum + (row.carriedOverDays || 0), 0);
        const usedDays = rows.reduce((sum, row) => sum + (row.usedDays || 0), 0);
        const projectedRemainingDays = rows.reduce((sum, row) => sum + (row.projectedRemainingDays || 0), 0);
        return [
            { label: 'Plantilla', value: formatNumber(rows.length), helper: 'Empleados con saldo calculado', tone: 'amber' },
            { label: 'Cupo total', value: formatNumber(totalQuota, ' días'), helper: 'Anuales más arrastradas', tone: 'blue' },
            { label: 'Arrastradas', value: formatNumber(carryOverDays, ' días'), helper: 'Saldo heredado del año previo', tone: 'amber' },
            { label: 'Consumidos', value: formatNumber(usedDays, ' días'), helper: 'Importadas y aprobadas', tone: 'rose' },
            { label: 'Saldo proj.', value: formatNumber(projectedRemainingDays, ' días'), helper: 'Después de pendientes', tone: 'emerald' }
        ];
    }

    if (activeTab === 'COSTS') {
        const totalCost = rows.reduce((sum, row) => sum + (row.totalCost || 0), 0);
        const totalBruto = rows.reduce((sum, row) => sum + (row.bruto || 0), 0);
        const totalSS = rows.reduce((sum, row) => sum + (row.ssEmpresa || 0), 0);
        return [
            { label: 'Personas', value: formatNumber(rows.length), helper: 'Nóminas agregadas', tone: 'violet' },
            { label: 'Coste total', value: formatCurrency(totalCost), helper: 'Coste empresa consolidado', tone: 'violet' },
            { label: 'Bruto', value: formatCurrency(totalBruto), helper: 'Retribución bruta agregada', tone: 'blue' },
            { label: 'SS empresa', value: formatCurrency(totalSS), helper: 'Carga social patronal', tone: 'amber' }
        ];
    }

    if (activeTab === 'ABSENCES_DETAILED') {
        const totalDays = rows.reduce((sum, row) => sum + (row.days || 0), 0);
        const maxDays = Math.max(...rows.map((row) => row.days || 0), 0);
        return [
            { label: 'Casos', value: formatNumber(rows.length), helper: 'Ausencias registradas', tone: 'rose' },
            { label: 'Personas', value: formatNumber(new Set(rows.map((row) => row.employee)).size), helper: 'Empleados afectados', tone: 'blue' },
            { label: 'Días', value: formatNumber(totalDays, ' días'), helper: 'Impacto acumulado', tone: 'amber' },
            { label: 'Mayor caso', value: formatNumber(maxDays, ' días'), helper: 'Ausencia más larga', tone: 'rose' }
        ];
    }

    if (activeTab === 'KPIS') {
        const summary = data?.summary || {};
        return [
            { label: 'Plantilla', value: formatNumber(summary.headcount || 0), helper: 'Personas activas en el periodo', tone: 'blue' },
            { label: 'Altas / Bajas', value: `${summary.hires || 0} / ${summary.exits || 0}`, helper: 'Movimientos del periodo', tone: 'violet' },
            { label: 'Rotación', value: formatPercent(summary.turnoverRate || 0), helper: 'Presión de reemplazo', tone: 'amber' },
            { label: 'Absentismo', value: formatPercent(summary.absenteeismRate || 0), helper: 'Tasa consolidada', tone: 'rose' }
        ];
    }

    if (activeTab === 'OBRA_SUMMARY') {
        const totalsByType: Record<string, number> = data?.totalsByType || {};
        const obras = Array.isArray(data?.obras) ? data.obras : [];
        const totalGastos = Object.values(totalsByType).reduce((a, b) => Number(a) + Number(b), 0);
        const { budgets = { budget: 0, consumed: 0 } } = data || {};
        const pct = budgets.budget > 0 ? (budgets.consumed / budgets.budget) * 100 : 0;
        const overBudget = budgets.budget > 0 && budgets.consumed > budgets.budget;
        return [
            { label: 'Obras', value: formatNumber(obras.length), helper: 'Proyectos contabilizados', tone: 'blue' },
            { label: 'Horas', value: formatNumber(data?.horasTotales || 0, ' h'), helper: 'Suma de EmployeeProjectWork', tone: 'emerald' },
            { label: 'Gasto total', value: formatCurrency(totalGastos), helper: 'Suma de todos los ObraExpense', tone: 'violet' },
            { label: 'Presupuesto', value: budgets.budget > 0 ? `${formatCurrency(budgets.budget)} (${formatPercent(pct)})` : 'Sin presupuesto', helper: overBudget ? 'Excedido' : 'Dentro del límite', tone: overBudget ? 'rose' : 'amber' }
        ];
    }

    if (activeTab === 'OBRA_EMPLOYEES') {
        const rows2 = Array.isArray(data) ? data : [];
        const totalAmount = rows2.reduce((sum, row) => sum + (row.total || 0), 0);
        const totalHours = rows2.reduce((sum, row) => sum + (row.hours || 0), 0);
        const obrasTouched = new Set(rows2.map((r) => r.obraCode).filter(Boolean)).size;
        const top = [...rows2].sort((a, b) => (b.total || 0) - (a.total || 0))[0];
        return [
            { label: 'Personas', value: formatNumber(rows2.length), helper: 'Empleados con imputación en obras', tone: 'blue' },
            { label: 'Obras', value: formatNumber(obrasTouched), helper: 'Obras cubiertas', tone: 'amber' },
            { label: 'Horas', value: formatNumber(totalHours, ' h'), helper: 'Horas imputadas', tone: 'emerald' },
            { label: 'Importe', value: formatCurrency(totalAmount), helper: top ? `Top: ${top.employee}` : 'Sin gastos', tone: 'violet' }
        ];
    }

    const summary = data?.summary || {};
    return [
        { label: 'Brecha', value: formatPercent(summary.gapPercentage || 0), helper: 'Gap salarial medio estimado', tone: 'rose' },
        { label: 'Hombres', value: formatNumber(summary.maleCount || 0), helper: 'Plantilla masculina', tone: 'blue' },
        { label: 'Mujeres', value: formatNumber(summary.femaleCount || 0), helper: 'Plantilla femenina', tone: 'rose' },
        { label: 'Media femenina', value: formatCurrency(summary.femaleAvgBruto || 0), helper: 'Bruto medio de mujeres', tone: 'emerald' }
    ];
}

export function buildInsight(activeTab: ReportType, rows: any[], data: any) {
    if (activeTab === 'ATTENDANCE') {
        const incomplete = rows.filter((row) => row.status === 'INCOMPLETE').length;
        if (incomplete === 0) return 'No se detectan jornadas incompletas en el periodo consultado.';
        return `${incomplete} jornada(s) requieren revisión. Prioriza las personas con segmentos abiertos o sin cierre.`;
    }

    if (activeTab === 'OVERTIME') {
        const topEmployee = [...rows].sort((left, right) => (right.totalCost || 0) - (left.totalCost || 0))[0];
        return topEmployee
            ? `${topEmployee.employee} concentra el mayor coste de extra con ${formatCurrency(topEmployee.totalCost || 0)}.`
            : 'No hay horas extra registradas en el periodo.';
    }

    if (activeTab === 'VACATIONS') {
        const lowBalance = rows.filter((row) => (row.projectedRemainingDays || 0) <= 5).length;
        return lowBalance > 0
            ? `${lowBalance} empleado(s) tienen 5 días o menos de saldo disponible. Conviene revisar cobertura y planificación.`
            : 'La plantilla mantiene un saldo razonable de vacaciones disponible.';
    }

    if (activeTab === 'COSTS') {
        const topDepartment = rows.reduce((best, row) => (!best || row.totalCost > best.totalCost ? row : best), null as any);
        return topDepartment
            ? `${topDepartment.employee} representa el coste individual más alto con ${formatCurrency(topDepartment.totalCost || 0)}.`
            : 'Todavía no hay costes consolidados para el periodo filtrado.';
    }

    if (activeTab === 'ABSENCES_DETAILED') {
        const byType = rows.reduce<Record<string, number>>((accumulator, row) => {
            accumulator[row.type] = (accumulator[row.type] || 0) + (row.days || 0);
            return accumulator;
        }, {});
        const dominantType = Object.entries(byType).sort((left, right) => right[1] - left[1])[0];
        return dominantType
            ? `La tipología dominante es ${dominantType[0]} con ${formatNumber(dominantType[1], ' días')} acumulados.`
            : 'No se registran ausencias en el rango actual.';
    }

    if (activeTab === 'KPIS') {
        const topDepartment = [...rows].sort((left, right) => (right.rate || 0) - (left.rate || 0))[0];
        return topDepartment
            ? `${topDepartment.department} presenta la mayor tasa de absentismo con ${formatPercent(topDepartment.rate || 0)}.`
            : 'No hay suficiente información departamental para calcular absentismo.';
    }

    if (activeTab === 'OBRA_SUMMARY') {
        const obras = Array.isArray(data?.obras) ? data.obras : [];
        const budgets = data?.budgets || { budget: 0, consumed: 0 };
        if (obras.length === 0) return 'Aún no hay obras con imputaciones.';
        const over = obras.filter((o: any) => Number(o.budget || 0) > 0 && Number(o.consumed || 0) > Number(o.budget || 0));
        if (over.length > 0) {
            return `${over.length} obra(s) superan el presupuesto planificado (${over.map((o: any) => o.code).join(', ')}). Conviene revisar el avance.`;
        }
        if (budgets.budget > 0 && budgets.consumed > budgets.budget) {
            return `El conjunto de obras supera el presupuesto agregado (${budgets.consumed.toFixed(0)} de ${budgets.budget.toFixed(0)}).`;
        }
        const top = [...obras].sort((a, b) => Number(b.consumed || 0) - Number(a.consumed || 0))[0];
        return top
            ? `${top.code} concentra el mayor volumen de gasto con ${formatCurrency(Number(top.consumed || 0))}.`
            : 'No hay obras con gasto registrado todavía.';
    }

    if (activeTab === 'OBRA_EMPLOYEES') {
        const rows2 = Array.isArray(data) ? data : [];
        if (rows2.length === 0) return 'Sin imputaciones de empleados en obras todavía.';
        const top = [...rows2].sort((a, b) => (Number(b.hours || 0) + Number(b.total || 0)) - (Number(a.hours || 0) + Number(a.total || 0)))[0];
        return top
            ? `${top.employee} es el empleado con mayor actividad en obras (${formatNumber(top.hours || 0, ' h')} + ${formatCurrency(top.total || 0)}).`
            : 'No hay datos suficientes.';
    }

    const highestGapDepartment = [...rows].sort((left, right) => (right.gap || 0) - (left.gap || 0))[0];
    return highestGapDepartment
        ? `${highestGapDepartment.department} muestra la mayor brecha departamental con ${formatPercent(highestGapDepartment.gap || 0)}.`
        : 'Todavía no hay masa crítica suficiente para calcular la brecha departamental.';
}

export function buildPdfTable(activeTab: ReportType, rows: any[], data: any) {
    if (activeTab === 'ATTENDANCE') {
        return {
            headers: ['Empleado', 'Fecha', 'Depto', 'Horas', 'Estado'],
            body: rows.map((row) => [row.employee, formatDate(row.date), row.department, formatNumber(row.totalHours, ' h'), row.status === 'COMPLETE' ? 'Completa' : 'Incompleta'])
        };
    }

    if (activeTab === 'OVERTIME') {
        return {
            headers: ['Empleado', 'Fecha', 'Horas', 'Tarifa', 'Coste'],
            body: rows.map((row) => [row.employee, formatDate(row.date), formatNumber(row.hours, ' h'), formatCurrency(row.rate), formatCurrency(row.totalCost)])
        };
    }

    if (activeTab === 'VACATIONS') {
        return {
            headers: ['Empleado', 'Depto', 'Cupo', 'Arrastre', 'Consumido', 'Pend.', 'Saldo proj.'],
            body: rows.map((row) => [
                row.employee,
                row.department,
                formatNumber(row.totalQuota),
                formatNumber(row.carriedOverDays),
                formatNumber(row.usedDays),
                formatNumber(row.pendingDays),
                formatNumber(row.projectedRemainingDays)
            ])
        };
    }

    if (activeTab === 'COSTS') {
        return {
            headers: ['Empleado', 'Bruto', 'SS Empresa', 'IRPF', 'Coste total'],
            body: rows.map((row) => [row.employee, formatCurrency(row.bruto), formatCurrency(row.ssEmpresa), formatCurrency(row.irpf), formatCurrency(row.totalCost)])
        };
    }

    if (activeTab === 'KPIS') {
        return {
            headers: ['Departamento', 'Empleados', 'Días ausencia', 'Tasa'],
            body: rows.map((row) => [row.department, row.employees, formatNumber(row.absenceDays), formatPercent(row.rate)])
        };
    }

    if (activeTab === 'GENDER_GAP') {
        const summary = data?.summary || {};
        return {
            headers: ['Departamento', 'Hombres', 'Mujeres', 'Gap'],
            body: [
                ['GLOBAL', summary.maleCount || 0, summary.femaleCount || 0, formatPercent(summary.gapPercentage || 0)],
                ...rows.map((row) => [row.department, row.maleCount, row.femaleCount, formatPercent(row.gap)])
            ]
        };
    }

    if (activeTab === 'OBRA_SUMMARY') {
        return {
            headers: ['Código', 'Obra', 'Cliente', 'Estado', 'Dietas', 'Hospedaje', 'Vuelo', 'Transp.', 'Otros', 'Horas', 'Presupuesto', '% usado'],
            body: rows.map((row) => [
                row.code,
                row.name,
                row.clientName,
                row.status === 'ACTIVE' ? 'Activa' : 'Cerrada',
                formatCurrency(row.perDiem),
                formatCurrency(row.lodging),
                formatCurrency(row.flight),
                formatCurrency(row.transport),
                formatCurrency(row.other),
                formatNumber(row.hours, ' h'),
                formatCurrency(row.budget || 0),
                row.budget > 0 ? formatPercent(row.pct * 100) : '-'
            ])
        };
    }

    if (activeTab === 'OBRA_EMPLOYEES') {
        return {
            headers: ['Empleado', 'Obra', 'Horas', 'Dietas', 'Hospedaje', 'Vuelo', 'Transp.', 'Otros', 'Total'],
            body: rows.map((row) => [
                row.employee,
                `${row.obraCode} · ${row.obra}`,
                formatNumber(row.hours, ' h'),
                formatCurrency(row.perDiem),
                formatCurrency(row.lodging),
                formatCurrency(row.flight),
                formatCurrency(row.transport),
                formatCurrency(row.other),
                formatCurrency(row.total)
            ])
        };
    }

    return {
        headers: ['Empleado', 'Inicio', 'Fin', 'Días', 'Tipo'],
        body: rows.map((row) => [row.employee, formatDate(row.startDate), formatDate(row.endDate), formatNumber(row.days), row.type])
    };
}
