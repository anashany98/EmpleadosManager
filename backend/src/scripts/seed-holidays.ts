/**
 * Siembra los festivos nacionales de 2025 y 2026 en la tabla `Holiday`.
 *
 * Solo `NATIONAL`. Los regionales y de empresa los añade el operador
 * desde la UI.
 *
 * Idempotente: si el festivo ya existe (mismo date+scope+region+companyId),
 * actualiza el nombre y no falla.
 *
 * Fuentes: BOE — calendario oficial de fiestas laborales.
 *   2025: https://www.boe.es/boe/dias/2025/10/03/
 *   2026: https://www.boe.es/boe/dias/2026/10/02/  (publicado en octubre 2025)
 */
import { prisma } from '../lib/prisma';

type Seed = { date: string; name: string };

const NATIONAL_2025: Seed[] = [
    { date: '2025-01-01', name: 'Año Nuevo' },
    { date: '2025-01-06', name: 'Epifanía del Señor' },
    { date: '2025-05-01', name: 'Fiesta del Trabajo' },
    { date: '2025-08-15', name: 'Asunción de la Virgen' },
    { date: '2025-10-12', name: 'Fiesta Nacional de España' },
    { date: '2025-11-01', name: 'Todos los Santos' },
    { date: '2025-12-06', name: 'Día de la Constitución' },
    { date: '2025-12-08', name: 'Inmaculada Concepción' },
    { date: '2025-12-25', name: 'Navidad' },
];

const NATIONAL_2026: Seed[] = [
    { date: '2026-01-01', name: 'Año Nuevo' },
    { date: '2026-01-06', name: 'Epifanía del Señor' },
    { date: '2026-05-01', name: 'Fiesta del Trabajo' },
    { date: '2026-08-15', name: 'Asunción de la Virgen' },
    { date: '2026-10-12', name: 'Fiesta Nacional de España' },
    { date: '2026-11-02', name: 'Todos los Santos (trasladado)' },
    { date: '2026-12-07', name: 'Día de la Constitución (trasladado)' },
    { date: '2026-12-08', name: 'Inmaculada Concepción' },
    { date: '2026-12-25', name: 'Navidad' },
];

const ALL = [...NATIONAL_2025, ...NATIONAL_2026];

const toUtcMidnight = (iso: string): Date => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
};

async function main() {
    let created = 0;
    let updated = 0;
    for (const h of ALL) {
        const date = toUtcMidnight(h.date);
        const existing = await prisma.holiday.findFirst({
            where: { date, scope: 'NATIONAL', region: null, companyId: null },
        });
        if (existing) {
            if (existing.name !== h.name) {
                await prisma.holiday.update({ where: { id: existing.id }, data: { name: h.name } });
                updated++;
            }
        } else {
            await prisma.holiday.create({
                data: { date, name: h.name, scope: 'NATIONAL', region: null, companyId: null },
            });
            created++;
        }
    }
    const total = await prisma.holiday.count();
    console.log(`[seed-holidays] OK · created=${created} updated=${updated} · total in DB: ${total}`);
}

main()
    .catch((e) => {
        console.error('[seed-holidays] FAIL', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
