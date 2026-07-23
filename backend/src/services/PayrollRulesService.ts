// PayrollRulesService — fuente única de verdad para las reglas
// fiscales y de cálculo de nómina.
//
// Diseño:
//
//   1. Las reglas son **inmutables** y **versionadas** por fecha de
//      efectividad. Un cambio legal (subida de IRPF, nuevo tramo
//      de SS, etc.) se aplica creando una nueva `PayrollRuleSet`
//      con un nuevo `version` y `effectiveFrom`. Las nóminas
//      existentes NO se recalculan: la regla que se usó en su
//      momento queda grabada en `PayrollRow.ruleSetVersion`.
//
//   2. Las reglas se almacenan **en código** (no en BD) por
//      simplicidad y porque cambian ~1 vez/año. Un cambio aquí se
//      despliega con un PR normal. Migrar a tabla BD es una mejora
//      futura (IMP-003) — el diseño `getRulesForDate()` ya está
//      pensado para que ese cambio sea transparente.
//
//   3. Los rates son `string` (no `number`) para evitar la
//      representación binaria de 0.0635, 0.15, 0.236 etc. Se
//      convierten a `Prisma.Decimal` en el momento del cálculo,
//      nunca antes.
//
//   4. El redondeo de la moneda es al céntimo (half-even /
//      banker's rounding) usando `Prisma.Decimal.toDecimalPlaces(2)`.
//      El redondeo se aplica al RESULTADO FINAL de cada
//      magnitud monetaria, no en cada multiplicación intermedia
//      (eso es la fuente de drift).

import { Prisma } from '@prisma/client';

export interface PayrollRuleSet {
    /** Identificador legible. Inmutable. */
    version: string;
    /** ISO date (YYYY-MM-DD) desde la que esta regla es la activa. */
    effectiveFrom: string;
    /** Descripción humana (para audit). */
    description: string;
    /** Cuota del trabajador a la Seguridad Social. Decimal como string. */
    ssWorkerRate: string;
    /** Tipo general del IRPF (tramo estatal). Decimal como string. */
    irpfRate: string;
    /** Cuota empresarial a la Seguridad Social. Decimal como string. */
    ssCompanyRate: string;
    /** Proporción máxima del salario que se paga (sueldo completo). */
    maxProportion: string;
    /** Por debajo de esta proporción de horas se marca WARNING. */
    minProportionForNoWarning: string;
}

// Reglas versionadas, ordenadas por effectiveFrom ascendente. La
// primera cuya `effectiveFrom <= fecha` es la activa para esa
// fecha. Si ninguna coincide, se usa la última.
const RULE_SETS: PayrollRuleSet[] = [
    {
        version: '2020-01-01',
        effectiveFrom: '2020-01-01',
        description: 'Reglas por defecto desde 2020. SS trabajador 6.35%, SS empresa 23.6%, IRPF general 15%.',
        ssWorkerRate: '0.0635',
        irpfRate: '0.15',
        ssCompanyRate: '0.236',
        maxProportion: '1.1',
        minProportionForNoWarning: '0.8'
    },
    {
        version: '2024-01-01',
        effectiveFrom: '2024-01-01',
        description: 'Subida de SS trabajador a 6.45% (reforma pensiones 2023, entrada en vigor 2024).',
        ssWorkerRate: '0.0645',
        irpfRate: '0.15',
        ssCompanyRate: '0.236',
        maxProportion: '1.1',
        minProportionForNoWarning: '0.8'
    }
];

/**
 * Devuelve la regla activa para una fecha dada. La regla activa es
 * la de mayor `effectiveFrom` que sea <= `date`. Si `date` es
 * anterior a la primera regla, se devuelve la primera (regla por
 * defecto).
 *
 * Implementación: comparamos por string ISO de fecha (YYYY-MM-DD)
 * en vez de por timestamp, para evitar problemas de zona horaria
 * (`new Date(2024, 0, 1)` en Madrid es `2023-12-31 23:00 UTC`,
 * antes que `2024-01-01 00:00 UTC`, lo que descartaría
 * incorrectamente la regla 2024-01-01).
 */
export function getRulesForDate(date: Date): PayrollRuleSet {
    const target = dateToIsoDate(date);
    let active = RULE_SETS[0];
    for (const rule of RULE_SETS) {
        // `effectiveFrom` ya viene como YYYY-MM-DD string
        if (rule.effectiveFrom <= target) {
            active = rule;
        } else {
            break;
        }
    }
    return active;
}

/**
 * Convierte un Date a su representación ISO de fecha (YYYY-MM-DD)
 * en zona horaria LOCAL. Esto es lo que el usuario percibe como
 * "la fecha" de su nómina.
 */
function dateToIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Devuelve todas las reglas versionadas, ordenadas por
 * `effectiveFrom` ascendente. Útil para admin UI y para tests.
 */
export function getAllRuleSets(): PayrollRuleSet[] {
    return [...RULE_SETS].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

/**
 * Convierte una regla versionada a un Prisma.Decimal de los rates.
 * Útil para los tests que quieren comparar contra un Decimal
 * exacto. La conversión a Decimal se hace aquí, no antes, para
 * preservar la precisión del string original.
 */
export function ruleSetToDecimals(rule: PayrollRuleSet): {
    ssWorkerRate: Prisma.Decimal;
    irpfRate: Prisma.Decimal;
    ssCompanyRate: Prisma.Decimal;
    maxProportion: Prisma.Decimal;
    minProportionForNoWarning: Prisma.Decimal;
} {
    return {
        ssWorkerRate: new Prisma.Decimal(rule.ssWorkerRate),
        irpfRate: new Prisma.Decimal(rule.irpfRate),
        ssCompanyRate: new Prisma.Decimal(rule.ssCompanyRate),
        maxProportion: new Prisma.Decimal(rule.maxProportion),
        minProportionForNoWarning: new Prisma.Decimal(rule.minProportionForNoWarning)
    };
}

/**
 * Redondea un `Prisma.Decimal` al céntimo usando banker's rounding
 * (half-even). Esto es el redondeo "neutro" que minimiza el
 * sesgo acumulado en cálculos financieros.
 */
export function roundToCents(value: Prisma.Decimal): Prisma.Decimal {
    return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_EVEN);
}

export const PayrollRulesService = {
    getRulesForDate,
    getAllRuleSets,
    ruleSetToDecimals,
    roundToCents
};
