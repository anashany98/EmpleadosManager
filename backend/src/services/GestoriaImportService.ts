/**
 * GestoriaImportService — importación de plantillas Excel al módulo gestoría.
 *
 * Recibe un JSON estructurado (generado por scripts/import_marcaje.py)
 * y crea:
 *   1. Un periodo (GestoriaPeriod)
 *   2. Los conceptos (GestoriaConcept)
 *   3. Opcionalmente filas de empleados con sus celdas (GestoriaEmployeeRow + GestoriaCell)
 */
import { prisma, Prisma } from '../lib/prisma';
import { createLogger } from './LoggerService';
import { AuditService, AuditAction, AuditEntity } from './AuditService';
import { AppError } from '../utils/AppError';
import { AuthUser } from '../types/express';

const log = createLogger('GestoriaImportService');

export interface ImportConcept {
    code: string;
    label: string;
    type: string;
    is_system?: boolean;
    decimals?: number;
}

export interface ImportCell {
    conceptCode: string;
    numericValue?: number | null;
    textValue?: string | null;
}

export interface ImportEmployee {
    employeeId?: string;
    employeeName: string;
    department?: string;
    category?: string;
    cells?: ImportCell[];
}

export interface ImportInput {
    companyId: string;
    year: number;
    month: number;
    notes?: string;
    concepts: ImportConcept[];
    employees?: ImportEmployee[];
    festivos?: string[];
    config?: {
        descanso_minutos?: number;
        horas_laborables?: number;
        limite_h_ext?: number;
        limite_h_ext_festivos?: number;
    };
    user: AuthUser;
}

/**
 * Importa una plantilla de marcaje Excel al módulo de gestoría.
 * Crea el periodo, conceptos y opcionalmente las filas de empleados.
 */
async function importFromExcel(input: ImportInput) {
    const { companyId, year, month, notes, concepts, employees, festivos, config, user } = input;

    // Verificar acceso a la empresa
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true }
    });
    if (!company) {
        throw new AppError('Empresa no encontrada', 404);
    }
    if (user.role !== 'admin' && user.companyId !== companyId) {
        throw new AppError('No tienes acceso a esta empresa', 403);
    }

    // Verificar que no exista el periodo
    const existing = await prisma.gestoriaPeriod.findUnique({
        where: { companyId_year_month: { companyId, year, month } }
    });
    if (existing) {
        throw new AppError(
            `Ya existe un periodo para ${year}-${String(month).padStart(2, '0')}`,
            409
        );
    }

    log.info(`Importando periodo ${year}-${month} para ${company.name}`);

    // Crear periodo + conceptos + filas en transacción
    const result = await prisma.$transaction(async (tx) => {
        // 1. Crear periodo
        const period = await tx.gestoriaPeriod.create({
            data: {
                companyId,
                year,
                month,
                notes: notes || `Importado desde Excel - ${new Date().toISOString().split('T')[0]}`,
                status: 'OPEN',
                createdById: user.id
            }
        });

        // 2. Crear conceptos
        const createdConcepts = [];
        for (let i = 0; i < concepts.length; i++) {
            const c = concepts[i];
            const concept = await tx.gestoriaConcept.create({
                data: {
                    periodId: period.id,
                    code: c.code.toUpperCase(),
                    label: c.label,
                    type: c.type as any,
                    isSystem: c.is_system || false,
                    isVisible: true,
                    order: i + 1,
                    decimals: c.decimals ?? 2
                }
            });
            createdConcepts.push(concept);
        }

        // 3. Crear filas de empleados (si se proporcionan)
        const createdRows = [];
        if (employees && employees.length > 0) {
            // Mapeo conceptCode -> conceptId
            const conceptMap = new Map(createdConcepts.map(c => [c.code.toUpperCase(), c.id]));

            for (const emp of employees) {
                const row = await tx.gestoriaEmployeeRow.create({
                    data: {
                        periodId: period.id,
                        employeeId: emp.employeeId || null,
                        employeeName: emp.employeeName,
                        department: emp.department || null,
                        category: emp.category || null
                    }
                });

                // Crear celdas del empleado
                if (emp.cells && emp.cells.length > 0) {
                    const cellData = emp.cells
                        .filter(c => {
                            const conceptId = conceptMap.get(c.conceptCode.toUpperCase());
                            return conceptId && (c.numericValue !== undefined && c.numericValue !== null || c.textValue);
                        })
                        .map(c => ({
                            rowId: row.id,
                            conceptId: conceptMap.get(c.conceptCode.toUpperCase())!,
                            numericValue: c.numericValue !== undefined && c.numericValue !== null
                                ? new Prisma.Decimal(c.numericValue)
                                : null,
                            textValue: c.textValue || null
                        }));

                    if (cellData.length > 0) {
                        await tx.gestoriaCell.createMany({ data: cellData });
                    }
                }

                createdRows.push(row);
            }
        }

        // 4. Auditar
        await AuditService.logWithContext(
            AuditAction.DATA_CREATE,
            AuditEntity.GESTORIA,
            period.id,
            {
                userId: user.id,
                metadata: {
                    companyId,
                    year,
                    month,
                    conceptCount: createdConcepts.length,
                    rowCount: createdRows.length,
                    importedFrom: 'excel_template'
                }
            }
        );

        return {
            period,
            concepts: createdConcepts,
            rows: createdRows
        };
    });

    log.info(
        `Importación completada: periodo ${result.period.id}, ` +
        `${result.concepts.length} conceptos, ${result.rows.length} filas`
    );

    return {
        periodId: result.period.id,
        period: {
            id: result.period.id,
            year: result.period.year,
            month: result.period.month,
            status: result.period.status
        },
        conceptsCreated: result.concepts.length,
        rowsCreated: result.rows.length,
        festivosCount: festivos?.length || 0,
        config
    };
}

export const GestoriaImportService = {
    importFromExcel
};
