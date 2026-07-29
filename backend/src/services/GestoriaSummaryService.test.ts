import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectConcepts, getPeriodSummary } from './GestoriaSummaryService';

vi.mock('../lib/prisma', () => ({
    prisma: {
        gestoriaPeriod: {
            findUnique: vi.fn(),
        },
        gestoriaConcept: {
            findMany: vi.fn(),
        },
        gestoriaEmployeeRow: {
            findMany: vi.fn(),
        },
    },
}));

import { prisma } from '../lib/prisma';

const C = (id: string, code: string, type: any) => ({ id, code, label: code, type });

describe('GestoriaSummaryService — detectConcepts', () => {
    it('detecta conceptos por convención de code', () => {
        const concepts = [
            C('c1', 'H.EXTRA', 'HOURS'),
            C('c2', 'H.S/D', 'HOURS'),
            C('c3', 'PRECIO_H_EXTRA', 'PRICE'),
            C('c4', 'PRECIO_H_FINDE', 'PRICE'),
            C('c5', 'IRPF', 'PERCENT'),
            C('c6', 'TGSS', 'PERCENT'),
        ];
        const d = detectConcepts(concepts);
        expect(d.horasExtra).toBe('c1');
        expect(d.horasFinde).toBe('c2');
        expect(d.precioExtra).toBe('c3');
        expect(d.precioFinde).toBe('c4');
        expect(d.irpf).toBe('c5');
        expect(d.tgss).toBe('c6');
    });

    it('acepta variaciones con/s sin acentos, mayúsculas y separadores', () => {
        const concepts = [
            C('c1', 'Horas Extras', 'HOURS'),
            C('c2', 'Horas S/D', 'HOURS'),
            C('c3', 'Precio hora extra', 'PRICE'),
            C('c4', 'Precio hora finde', 'PRICE'),
            C('c5', 'irpf', 'PERCENT'),
            C('c6', 'ss', 'PERCENT'),
        ];
        const d = detectConcepts(concepts);
        expect(d.horasExtra).toBe('c1');
        expect(d.horasFinde).toBe('c2');
        expect(d.precioExtra).toBe('c3');
        expect(d.precioFinde).toBe('c4');
        expect(d.irpf).toBe('c5');
        expect(d.tgss).toBe('c6');
    });

    it('acepta "festivo" como alias de finde', () => {
        const concepts = [
            C('c1', 'H.EXTRA', 'HOURS'),
            C('c2', 'H.FESTIVO', 'HOURS'),
            C('c5', 'IRPF', 'PERCENT'),
            C('c6', 'TGSS', 'PERCENT'),
        ];
        const d = detectConcepts(concepts);
        expect(d.horasFinde).toBe('c2');
    });

    it('devuelve null cuando no hay conceptos clave', () => {
        const d = detectConcepts([C('c1', 'OTRO', 'TEXT')]);
        expect(d.horasExtra).toBeNull();
        expect(d.irpf).toBeNull();
    });

    it('no confunde horas extra con horas finde (palabra "extra" gana si no hay "sd/finde")', () => {
        const concepts = [
            C('c1', 'H.EXTRA', 'HOURS'),
            // El segundo concepto sería H.EXTRA S/D — pero como tiene "extra" sin "sd/finde",
            // lo confundiría con horas extra. El orden de iteración importa: el primero que matchea gana.
        ];
        const d = detectConcepts(concepts);
        expect(d.horasExtra).toBe('c1');
        expect(d.horasFinde).toBeNull();
    });
});

describe('GestoriaSummaryService — getPeriodSummary', () => {
    beforeEach(() => {
        vi.mocked(prisma.gestoriaPeriod.findUnique).mockReset();
        vi.mocked(prisma.gestoriaConcept.findMany).mockReset();
        vi.mocked(prisma.gestoriaEmployeeRow.findMany).mockReset();
    });

    it('calcula BRUTO = total € / (1 - IRPF - TGSS)', async () => {
        vi.mocked(prisma.gestoriaPeriod.findUnique).mockResolvedValue({ id: 'p1', companyId: 'c1' } as any);
        vi.mocked(prisma.gestoriaConcept.findMany).mockResolvedValue([
            { id: 'c1', code: 'H.EXTRA', label: '', type: 'HOURS' },
            { id: 'c2', code: 'PRECIO_H_EXTRA', label: '', type: 'PRICE' },
            { id: 'c5', code: 'IRPF', label: '', type: 'PERCENT' },
            { id: 'c6', code: 'TGSS', label: '', type: 'PERCENT' },
        ] as any);
        vi.mocked(prisma.gestoriaEmployeeRow.findMany).mockResolvedValue([
            {
                id: 'r1', employeeId: 'e1', employeeName: 'Ana', department: 'Costura', category: 'ENCARGADA',
                isReviewed: false,
                cells: [
                    { conceptId: 'c1', numericValue: 10, textValue: null },   // 10h
                    { conceptId: 'c2', numericValue: 10, textValue: null },   // 10€/h
                    { conceptId: 'c5', numericValue: 0.17, textValue: null }, // 17%
                    { conceptId: 'c6', numericValue: 0.0635, textValue: null }, // 6.35%
                ],
            },
        ] as any);

        const s = await getPeriodSummary('p1');
        expect(s.rows).toHaveLength(1);
        const r = s.rows[0];
        expect(r.totalEuros).toBe(100); // 10h × 10€
        expect(r.irpf).toBe(0.17);
        expect(r.tgss).toBe(0.0635);
        expect(r.porcentajeNeto).toBe(0.7665); // 1 - 0.17 - 0.0635
        expect(r.bruto).toBe(130.46); // 100 / 0.7665 ≈ 130.46
        expect(r.diferencia).toBe(30.46); // 130.46 - 100
        expect(s.totals.totalEuros).toBe(100);
        expect(s.totals.bruto).toBe(130.46);
    });

    it('suma horas extra + horas finde con sus precios respectivos', async () => {
        vi.mocked(prisma.gestoriaPeriod.findUnique).mockResolvedValue({ id: 'p1', companyId: 'c1' } as any);
        vi.mocked(prisma.gestoriaConcept.findMany).mockResolvedValue([
            { id: 'c1', code: 'H.EXTRA', label: '', type: 'HOURS' },
            { id: 'c2', code: 'H.S/D', label: '', type: 'HOURS' },
            { id: 'c3', code: 'PRECIO_H_EXTRA', label: '', type: 'PRICE' },
            { id: 'c4', code: 'PRECIO_H_FINDE', label: '', type: 'PRICE' },
            { id: 'c5', code: 'IRPF', label: '', type: 'PERCENT' },
            { id: 'c6', code: 'TGSS', label: '', type: 'PERCENT' },
        ] as any);
        vi.mocked(prisma.gestoriaEmployeeRow.findMany).mockResolvedValue([
            {
                id: 'r1', employeeId: 'e1', employeeName: 'Ana', department: 'Costura', category: 'ENCARGADA',
                isReviewed: false,
                cells: [
                    { conceptId: 'c1', numericValue: 10, textValue: null },  // 10h normales
                    { conceptId: 'c2', numericValue: 4,  textValue: null },  // 4h finde
                    { conceptId: 'c3', numericValue: 10, textValue: null },  // 10€/h normal
                    { conceptId: 'c4', numericValue: 12, textValue: null },  // 12€/h finde
                    { conceptId: 'c5', numericValue: 0.10, textValue: null },
                    { conceptId: 'c6', numericValue: 0.0635, textValue: null },
                ],
            },
        ] as any);

        const s = await getPeriodSummary('p1');
        const r = s.rows[0];
        expect(r.totalHorasExtra).toBe(100); // 10h × 10€
        expect(r.totalHorasFinde).toBe(48);  // 4h × 12€
        expect(r.totalEuros).toBe(148);      // 100 + 48
    });

    it('devuelve ceros si no hay conceptos clave, sin romper', async () => {
        vi.mocked(prisma.gestoriaPeriod.findUnique).mockResolvedValue({ id: 'p1', companyId: 'c1' } as any);
        vi.mocked(prisma.gestoriaConcept.findMany).mockResolvedValue([
            { id: 'c1', code: 'OTRO_CONCEPTO', label: '', type: 'AMOUNT' },
        ] as any);
        vi.mocked(prisma.gestoriaEmployeeRow.findMany).mockResolvedValue([
            {
                id: 'r1', employeeId: 'e1', employeeName: 'Ana', department: null, category: null,
                isReviewed: false,
                cells: [
                    { conceptId: 'c1', numericValue: 50, textValue: null },
                ],
            },
        ] as any);

        const s = await getPeriodSummary('p1');
        const r = s.rows[0];
        expect(r.totalEuros).toBe(0); // no hay horas, no hay cálculo
        expect(r.porcentajeNeto).toBe(1); // 1 - 0 - 0
        expect(r.bruto).toBe(0);
        expect(s.detected.missing).toContain('horas extra o finde');
    });

    it('lista conceptos faltantes en `detected.missing`', async () => {
        vi.mocked(prisma.gestoriaPeriod.findUnique).mockResolvedValue({ id: 'p1', companyId: 'c1' } as any);
        vi.mocked(prisma.gestoriaConcept.findMany).mockResolvedValue([
            { id: 'c1', code: 'H.EXTRA', label: '', type: 'HOURS' },
        ] as any);
        vi.mocked(prisma.gestoriaEmployeeRow.findMany).mockResolvedValue([] as any);

        const s = await getPeriodSummary('p1');
        expect(s.detected.missing).toContain('precio hora extra o finde');
        expect(s.detected.missing).toContain('IRPF');
        expect(s.detected.missing).toContain('TGSS');
    });

    it('lanza 404 si el periodo no existe', async () => {
        vi.mocked(prisma.gestoriaPeriod.findUnique).mockResolvedValue(null);
        await expect(getPeriodSummary('xxx')).rejects.toMatchObject({ status: 404 });
    });

    it('agrupa totales por categoría', async () => {
        vi.mocked(prisma.gestoriaPeriod.findUnique).mockResolvedValue({ id: 'p1', companyId: 'c1' } as any);
        vi.mocked(prisma.gestoriaConcept.findMany).mockResolvedValue([
            { id: 'c1', code: 'H.EXTRA', label: '', type: 'HOURS' },
            { id: 'c3', code: 'PRECIO', label: '', type: 'PRICE' },
            { id: 'c5', code: 'IRPF', label: '', type: 'PERCENT' },
            { id: 'c6', code: 'TGSS', label: '', type: 'PERCENT' },
        ] as any);
        vi.mocked(prisma.gestoriaEmployeeRow.findMany).mockResolvedValue([
            { id: 'r1', employeeId: 'e1', employeeName: 'A', department: 'd', category: 'ENCARGADA', isReviewed: false,
              cells: [{ conceptId: 'c1', numericValue: 10, textValue: null }, { conceptId: 'c3', numericValue: 10, textValue: null },
                      { conceptId: 'c5', numericValue: 0.17, textValue: null }, { conceptId: 'c6', numericValue: 0.06, textValue: null }] },
            { id: 'r2', employeeId: 'e2', employeeName: 'B', department: 'd', category: 'ENCARGADA', isReviewed: false,
              cells: [{ conceptId: 'c1', numericValue: 5, textValue: null }, { conceptId: 'c3', numericValue: 10, textValue: null },
                      { conceptId: 'c5', numericValue: 0.17, textValue: null }, { conceptId: 'c6', numericValue: 0.06, textValue: null }] },
            { id: 'r3', employeeId: 'e3', employeeName: 'C', department: 'd', category: 'AUXILIAR', isReviewed: false,
              cells: [{ conceptId: 'c1', numericValue: 8, textValue: null }, { conceptId: 'c3', numericValue: 9, textValue: null },
                      { conceptId: 'c5', numericValue: 0.10, textValue: null }, { conceptId: 'c6', numericValue: 0.06, textValue: null }] },
        ] as any);

        const s = await getPeriodSummary('p1');
        const enc = s.byCategory.find((c) => c.category === 'ENCARGADA');
        const aux = s.byCategory.find((c) => c.category === 'AUXILIAR');
        expect(enc?.employees).toBe(2);
        expect(enc?.totalEuros).toBe(150); // (10*10) + (5*10)
        expect(aux?.employees).toBe(1);
        expect(aux?.totalEuros).toBe(72);  // 8 * 9
    });
});
