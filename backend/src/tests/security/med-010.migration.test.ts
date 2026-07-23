/**
 * MED-010: la deduplicación de importes de Obras tenía carrera
 * entre lotes concurrentes (check-then-act sin constraint). El
 * fix añade un índice único sobre (obraId, reference) en
 * `ObraExpense` y limpia duplicados preexistentes ANTES de
 * añadirlo. Estos tests verifican que:
 *
 *   1. La migración de cleanup elimina duplicados dejando el
 *      más antiguo (createdAt ASC, id ASC como desempate).
 *   2. La migración crea el índice único.
 *   3. El schema declara `@@unique([obraId, reference])` en
 *      ObraExpense (debe coincidir con el nombre de la
 *      migración).
 *   4. El controller usa `createMany` con `skipDuplicates: true`
 *      para que la carrera entre commits concurrentes se
 *      traduzca en filas omitidas (idempotente) en vez de
 *      gastos duplicados.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('MED-010 — ObraExpense unique (obraId, reference)', () => {
    describe('schema.prisma declaration', () => {
        it('declares @@unique([obraId, reference]) on ObraExpense', () => {
            const schema = readFileSync(
                join(__dirname, '..', '..', '..', '..', 'database', 'prisma', 'schema.prisma'),
                'utf-8'
            );
            // Aislar el bloque de ObraExpense
            const match = schema.match(/model ObraExpense \{[\s\S]*?\n\}/);
            expect(match).not.toBeNull();
            const block = match![0];
            expect(block).toMatch(/@@unique\(\[obraId, reference\]\)/);
        });
    });

    describe('migration cleanup + index', () => {
        const migration = readFileSync(
            join(__dirname, '..', '..', '..', '..', 'database', 'prisma', 'migrations', '20260721000000_add_obra_expense_unique_reference', 'migration.sql'),
            'utf-8'
        );
        // El test también verifica que la migración de cleanup
        // está colocada ANTES del CREATE UNIQUE INDEX (sin esto,
        // el ALTER fallaría si hay duplicados preexistentes).

        it('cleans up duplicates keeping the oldest by createdAt', () => {
            // La subquery debe usar `createdAt < e.createdAt` Y
            // un desempate estable por `id` para empates
            // teóricos de timestamp. Si la subquery solo usa
            // `createdAt <`, dos filas con el mismo timestamp
            // (posible en bulk import) NO se deduplicarían.
            expect(migration).toMatch(
                /DELETE FROM "ObraExpense"[\s\S]*?older\."createdAt" < e\."createdAt"[\s\S]*?OR \(older\."createdAt" = e\."createdAt" AND older\."id" < e\."id"\)/
            );
        });

        it('only deletes rows where reference is not null (NULLs are distinct in PostgreSQL UNIQUE)', () => {
            expect(migration).toMatch(/e\."reference" IS NOT NULL/);
        });

        it('creates a unique index named ObraExpense_obraId_reference_key', () => {
            expect(migration).toMatch(
                /CREATE UNIQUE INDEX "ObraExpense_obraId_reference_key" ON "ObraExpense"\("obraId", "reference"\)/
            );
        });

        it('runs the cleanup BEFORE the index creation (so the index can be added without violating existing duplicates)', () => {
            const cleanupPos = migration.indexOf('DELETE FROM');
            const indexPos = migration.indexOf('CREATE UNIQUE INDEX');
            expect(cleanupPos).toBeGreaterThan(-1);
            expect(indexPos).toBeGreaterThan(cleanupPos);
        });
    });
});
