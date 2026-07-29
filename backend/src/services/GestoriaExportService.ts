/**
 * GestoriaExportService — orquesta la generación del .xls de gestoría.
 *
 * Pipeline:
 *   1) Carga el periodo + filas + celdas + conceptos + mapeo
 *   2) Construye un JSON con `rows: [{ sheet, values: {B5, C5, …} }]`
 *      aplicando el `exportMapping` del periodo:
 *        - Para cada fila de empleado, se busca la siguiente celda
 *          vacía verticalmente según la base row (configurable).
 *        - Si el mapeo es `{"EMPLOYEE_NAME": "D5", "H.EXT": "B5", …}`,
 *          la primera fila escribe en B5, C5, D5; la segunda en
 *          B6, C6, D6, etc. (offset incremental).
 *   3) Ejecuta `python backend/scripts/gestoria_export.py
 *      --template ... --data ... --output ...` como child process.
 *   4) Lee el .xls resultante, lo transmite al cliente, registra
 *      `GestoriaExportLog` con sha256 + tamaño.
 *
 * Decisiones:
 *   - El "layout de filas" es responsabilidad del mapeo + el
 *     `rowOffset` del JSON. La plantilla original puede tener
 *     varios empleados apilados verticalmente; el mapping
 *     describe la PRIMERA fila de la primera, y el offset las
 *     siguientes.
 *   - Si falta la contraseña, el servicio NO falla en silencio:
 *     devuelve un error claro al cliente (HTTP 503 con
 *     `errorCode: 'GESTORIA_TEMPLATE_PASSWORD_MISSING'`).
 *   - El .xls generado se BORRA del disco tras la transmisión.
 *     Se conserva solo el hash, tamaño y metadatos en
 *     `GestoriaExportLog`.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import { prisma } from '../lib/prisma';
import { createLogger } from './LoggerService';
import { AuditService, AuditAction, AuditEntity } from './AuditService';
import { AppError } from '../utils/AppError';
import { AuthUser } from '../types/express';

const log = createLogger('GestoriaExportService');

const unlinkAsync = promisify(fs.unlink);
const mkdtempAsync = promisify(fs.mkdtemp);
const writeFileAsync = promisify(fs.writeFile);

/**
 * Tabla de traduccion `codigo de plantilla .xls` -> `columna` en la
 * hoja "Conceptos" de la plantilla de gestoria estandar (7 columnas
 * de importes entre la B de Codigo y el final de la fila).
 *
 * Filas 9-91 (83 empleados), columnas D-J para los importes:
 *   D = 044 ATRASOS
 *   E = 048 COMISION
 *   F = 050 PRODUC
 *   G = 182 Gastos l
 *   H = 434 H.EXT. 1
 *   I = 604 DIETAS
 *   J = 791 ANT.SEM.
 *
 * Si en el futuro se necesita otra plantilla, lo unico a cambiar es
 * esta constante — la logica del resto del servicio no asume la
 * estructura concreta.
 */
const GESTORIA_COLUMN_MAP: Record<string, string> = {
    '044': 'D',
    '048': 'E',
    '050': 'F',
    '182': 'G',
    '434': 'H',
    '604': 'I',
    '791': 'J',
};

/** Primera fila de datos en la plantilla (fila 9, debajo de los headers en fila 8). */
const GESTORIA_BASE_ROW = 9;

/**
 * Construye el `exportMapping` efectivo para un periodo, mezclando:
 *   1) El `exportMapping` manual del periodo (si existe), que manda.
 *   2) Los `gestoriaCode` de los conceptos, auto-derivados a
 *      `{ CONCEPT_CODE: "COL_LETTER + baseRow" }`.
 *
 * Esto permite que el operador:
 *   - En el caso normal, NUNCA toque el mapping: asigna un
 *     `gestoriaCode` a cada concepto y la app lo resuelve.
 *   - En el caso exotico (plantilla custom), defina el mapping
 *     manual en la pantalla de export y eso toma precedencia.
 */
function buildEffectiveMapping(period: any): Record<string, string> {
    const manual = (period.exportMapping as Record<string, string> | null) || {};
    const derived: Record<string, string> = {};
    for (const c of period.concepts || []) {
        if (!c.gestoriaCode) continue;
        const col = GESTORIA_COLUMN_MAP[c.gestoriaCode];
        if (!col) continue;
        // c.code es la clave que buildExportData busca en el mapping
        // (el `code` del GestoriaConcept, no el `gestoriaCode`).
        derived[c.code] = `${col}${GESTORIA_BASE_ROW}`;
    }
    return { ...derived, ...manual };
}

/**
 * Ruta al script Python. Asume que el backend se ejecuta desde
 * `backend/` o desde la raíz del repo (mismo cwd que `node`).
 *
 * Estrategia: probar varias ubicaciones razonables.
 */
function resolvePythonScriptPath(): string {
    const candidates = [
        path.resolve(process.cwd(), 'scripts', 'gestoria_export.py'),
        path.resolve(process.cwd(), 'backend', 'scripts', 'gestoria_export.py'),
        path.resolve(__dirname, '..', '..', 'scripts', 'gestoria_export.py')
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    // Por defecto, devolvemos el candidato "estándar" para que el
    // mensaje de error sea útil.
    return candidates[0];
}

function resolveTemplatePath(): string {
    const candidates = [
        path.resolve(process.cwd(), 'assets', 'templates', 'gestoria_template.xls'),
        path.resolve(process.cwd(), 'backend', 'assets', 'templates', 'gestoria_template.xls'),
        path.resolve(__dirname, '..', '..', 'assets', 'templates', 'gestoria_template.xls')
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    return candidates[0];
}

/**
 * Carga los datos para el export: periodo + filas + celdas + conceptos.
 * Inyecta `effectiveMapping` derivado de los `gestoriaCode` para que
 * `buildExportData` no tenga que repetir la logica de auto-mapping.
 */
async function loadExportData(periodId: string) {
    const period = await prisma.gestoriaPeriod.findUnique({
        where: { id: periodId },
        include: {
            concepts: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
            rows: {
                orderBy: [{ department: 'asc' }, { employeeName: 'asc' }],
                include: {
                    // cells.concept es necesario para resolver el `code`
                    // del concepto en buildExportData (mapping por code).
                    cells: { include: { concept: true } }
                }
            }
        }
    });
    if (!period) throw new AppError('Periodo no encontrado', 404);
    (period as any).effectiveMapping = buildEffectiveMapping(period);
    return period;
}

interface ExportBuildResult {
    data: any;
    rowCount: number;
    totalAmount: number;
    missingMappings: string[];
    effectiveMapping: Record<string, string>;
}

/**
 * Construye el JSON que el script Python espera.
 *
 * Reglas:
 *   - El `effectiveMapping` (mezcla de `gestoriaCode` auto-derivado +
 *     `exportMapping` manual) es `{ CODE_CONCEPTO: "DIRECCION" }`.
 *     La dirección base define la primera fila; las siguientes se
 *     numeran incrementalmente (B5 → B6 → B7 → …).
 *   - Si un concepto no tiene mapeo, se omite del output y se
 *     reporta en `missingMappings` (warning, no error).
 *   - El total general se escribe en la dirección
 *     `effectiveMapping.__total__` si existe.
 */
function buildExportData(period: any): ExportBuildResult {
    const mapping = (period.effectiveMapping as Record<string, string>) || buildEffectiveMapping(period);
    const missing: string[] = [];
    const rows: any[] = [];

    // Filtrar filas que tengan al menos una celda con valor
    const periodsRows = period.rows as any[];
    let totalAmount = 0;

    // Plantilla: por defecto, escribir en la primera hoja. Si el
    // operador define un sheet, lo respetamos.
    const sheetName = (mapping as any).__sheet__ as string | undefined;

    let rowIndex = 0;
    for (const row of periodsRows) {
        const values: Record<string, string | number | boolean> = {};
        for (const cell of row.cells) {
            const code = cell.concept.code as string;
            const addr = mapping[code];
            if (!addr) {
                if (!missing.includes(code)) missing.push(code);
                continue;
            }
            // addr es del estilo "B5". Incrementar fila por rowIndex.
            const m = /^([A-Z]+)(\d+)$/.exec(addr);
            if (!m) continue;
            const colLetters = m[1];
            const baseRow = parseInt(m[2], 10);
            const newAddr = `${colLetters}${baseRow + rowIndex}`;
            if (cell.textValue !== null && cell.textValue !== undefined) {
                values[newAddr] = cell.textValue;
            } else if (cell.numericValue !== null && cell.numericValue !== undefined) {
                values[newAddr] = Number(cell.numericValue);
            } else {
                continue;
            }
        }
        // Si no se ha incluido el nombre del empleado, lo añadimos
        // si hay mapeo EMPLOYEE_NAME
        const employeeAddr = mapping.EMPLOYEE_NAME || mapping.EMPLOYEE;
        if (employeeAddr && !values[employeeAddr]) {
            const m = /^([A-Z]+)(\d+)$/.exec(employeeAddr);
            if (m) {
                const addr = `${m[1]}${parseInt(m[2], 10) + rowIndex}`;
                values[addr] = row.employeeName;
            }
        }
        // Departamento si hay mapeo
        const deptAddr = mapping.DEPARTMENT;
        if (deptAddr && row.department) {
            const m = /^([A-Z]+)(\d+)$/.exec(deptAddr);
            if (m) {
                const addr = `${m[1]}${parseInt(m[2], 10) + rowIndex}`;
                values[addr] = row.department;
            }
        }
        if (Object.keys(values).length > 0) {
            const rowPayload: any = { sheet: sheetName, values };
            rows.push(rowPayload);
        }
        if (row.totalAmount != null) {
            totalAmount += Number(row.totalAmount);
        }
        rowIndex += 1;
    }

    return {
        data: { rows },
        rowCount: periodsRows.length,
        totalAmount,
        missingMappings: missing,
        effectiveMapping: mapping
    };
}

/**
 * Ejecuta el script Python y devuelve el JSON parseado.
 */
async function runPythonExport(
    templatePath: string,
    data: any,
    outputPath: string
): Promise<{
    ok: boolean;
    writtenCells?: number;
    missingCells?: any[];
    outputSize?: number;
    outputHash?: string;
    error?: string;
    trace?: string;
}> {
    const scriptPath = resolvePythonScriptPath();
    const dataPath = outputPath + '.data.json';
    await writeFileAsync(dataPath, JSON.stringify(data), 'utf8');

    const py = process.env.GESTORIA_PYTHON || 'python';
    return new Promise((resolve) => {
        const child = spawn(py, [scriptPath, '--template', templatePath, '--data', dataPath, '--output', outputPath], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env }
        });
        let out = '';
        let err = '';
        child.stdout.on('data', (chunk) => { out += chunk.toString('utf8'); });
        child.stderr.on('data', (chunk) => { err += chunk.toString('utf8'); });
        child.on('error', (e) => {
            // Limpiar el .data.json
            fs.promises.unlink(dataPath).catch(() => undefined);
            resolve({ ok: false, error: `No se pudo ejecutar Python: ${e.message}` });
        });
        child.on('close', (code) => {
            // Limpiar el .data.json
            fs.promises.unlink(dataPath).catch(() => undefined);
            if (code !== 0) {
                log.error({ err, code }, 'Python export failed');
                // Intentar parsear el JSON del stderr (puede ser un dict)
                let errObj: any = { ok: false, error: `Python exited with code ${code}` };
                try {
                    const lines = err.split('\n').filter(Boolean);
                    const last = lines[lines.length - 1];
                    if (last && last.trim().startsWith('{')) {
                        errObj = { ...errObj, ...JSON.parse(last) };
                    } else {
                        errObj.error = err.trim() || errObj.error;
                    }
                } catch {
                    // Mantener el error genérico
                }
                resolve(errObj);
                return;
            }
            try {
                const json = JSON.parse(out.trim());
                resolve(json);
            } catch (e: any) {
                resolve({ ok: false, error: `Output de Python no es JSON: ${e.message}. Output: ${out.slice(0, 500)}` });
            }
        });
    });
}

export const GestoriaExportService = {
    /**
     * Previsualiza el export: carga datos, simula las direcciones de
     * celda y devuelve un JSON con la composición que se escribiría.
     * NO genera el .xls ni persiste log.
     *
     * Devuelve:
     *   - `effectiveMapping`: el mapping real que se usaría (mezcla
     *     de gestoriaCode auto + exportMapping manual).
     *   - `manualMapping`: solo el mapping manual del periodo (lo que
     *     el operador escribió a mano en la pantalla de export).
     *   - `autoMapping`: solo el mapping auto-derivado de gestoriaCode.
     */
    async preview(periodId: string, user: AuthUser) {
        const period = await loadExportData(periodId);
        if (user.role !== 'admin' && period.companyId !== user.companyId) {
            throw new AppError('No tienes acceso a este periodo', 403);
        }
        const built = buildExportData(period);
        return {
            rowCount: built.rowCount,
            totalAmount: built.totalAmount,
            missingMappings: built.missingMappings,
            effectiveMapping: built.effectiveMapping,
            manualMapping: period.exportMapping || {},
            autoMapping: buildEffectiveMapping(period),
            // Una muestra de las primeras 3 filas para que el UI
            // pueda mostrar "así quedaría".
            sample: built.data.rows.slice(0, 3),
            // ¿Está la plantilla lista para generar?
            templateReady: fs.existsSync(resolveTemplatePath()),
            templatePath: resolveTemplatePath(),
            passwordConfigured: Boolean(process.env.GESTORIA_TEMPLATE_PASSWORD),
            // Lista de columnas soportadas para el dropdown del UI
            supportedGestoriaCodes: Object.keys(GESTORIA_COLUMN_MAP)
        };
    },

    /**
     * Genera el .xls. Persiste el log y devuelve el path temporal
     * + metadatos. El controller transmite el buffer y borra el
     * archivo.
     */
    async generate(periodId: string, user: AuthUser): Promise<{
        filePath: string;
        outputFilename: string;
        fileSize: number;
        fileHash: string;
        rowCount: number;
        totalAmount: number | null;
        logId: string;
        missingMappings: string[];
    }> {
        const period = await loadExportData(periodId);
        if (user.role !== 'admin' && period.companyId !== user.companyId) {
            throw new AppError('No tienes acceso a este periodo', 403);
        }
        const built = buildExportData(period);
        if (built.rowCount === 0) {
            throw new AppError('El periodo no tiene filas para exportar', 400);
        }

        const templatePath = resolveTemplatePath();
        if (!fs.existsSync(templatePath)) {
            throw new AppError(
                `Plantilla de gestoría no encontrada en ${templatePath}. Coloque el .xls en backend/assets/templates/gestoria_template.xls`,
                503
            );
        }

        // Generar path temporal
        const tmpDir = await mkdtempAsync(path.join(os.tmpdir(), 'gestoria-'));
        const outputFilename = `gestoria_${period.companyId}_${period.year}-${String(period.month).padStart(2, '0')}_${Date.now()}.xls`;
        const filePath = path.join(tmpDir, outputFilename);

        const result = await runPythonExport(templatePath, built.data, filePath);
        if (!result.ok) {
            // Limpiar tmp
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* noop */ }
            // Distinguir error de contraseña de otros errores
            if (result.error && /GESTORIA_TEMPLATE_PASSWORD|cifrada/i.test(result.error)) {
                throw new AppError(
                    'GESTORIA_TEMPLATE_PASSWORD no configurada. Configure la variable de entorno y reinicie el backend.',
                    503
                );
            }
            throw new AppError(`Error generando .xls: ${result.error}`, 500);
        }

        // Persistir log
        const logEntry = await prisma.gestoriaExportLog.create({
            data: {
                periodId,
                generatedById: user.id,
                outputFilename,
                fileSize: result.outputSize ?? 0,
                fileHash: result.outputHash ?? '',
                rowCount: built.rowCount,
                totalAmount: built.totalAmount || null,
                mappingSnapshot: (period.exportMapping as any) ?? {},
                notes: built.missingMappings.length > 0 ? `Mapeos faltantes: ${built.missingMappings.join(', ')}` : null
            }
        });

        await AuditService.log(
            AuditAction.GESTORIA_EXPORT,
            AuditEntity.GESTORIA,
            logEntry.id,
            {
                action: 'export',
                periodId,
                rowCount: built.rowCount,
                fileSize: result.outputSize,
                fileHash: result.outputHash,
                missingMappings: built.missingMappings
            },
            user.id
        );

        return {
            filePath,
            outputFilename,
            fileSize: result.outputSize ?? 0,
            fileHash: result.outputHash ?? '',
            rowCount: built.rowCount,
            totalAmount: built.totalAmount || null,
            logId: logEntry.id,
            missingMappings: built.missingMappings
        };
    },

    /**
     * Borra el archivo temporal. Llamar SIEMPRE después de
     * transmitir el .xls (éxito o error).
     */
    async cleanup(filePath: string): Promise<void> {
        const dir = path.dirname(filePath);
        try {
            await unlinkAsync(filePath);
        } catch { /* noop */ }
        try {
            if (fs.existsSync(dir) && path.basename(dir).startsWith('gestoria-')) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        } catch { /* noop */ }
    },

    /**
     * Lee el archivo como Buffer para transmitir.
     */
    async readFile(filePath: string): Promise<Buffer> {
        return fs.promises.readFile(filePath);
    },

    /**
     * Historial de exportaciones de un periodo.
     */
    async listLogs(periodId: string, user: AuthUser) {
        const period = await prisma.gestoriaPeriod.findUnique({ where: { id: periodId } });
        if (!period) throw new AppError('Periodo no encontrado', 404);
        if (user.role !== 'admin' && period.companyId !== user.companyId) {
            throw new AppError('No tienes acceso a este periodo', 403);
        }
        return prisma.gestoriaExportLog.findMany({
            where: { periodId },
            orderBy: { generatedAt: 'desc' }
        });
    },

    /**
     * Registra una descarga. Incrementa el contador en el log.
     */
    async recordDownload(logId: string, user: AuthUser) {
        const logEntry = await prisma.gestoriaExportLog.findUnique({ where: { id: logId } });
        if (!logEntry) throw new AppError('Log no encontrado', 404);
        await prisma.gestoriaExportLog.update({
            where: { id: logId },
            data: { downloadCount: { increment: 1 } }
        });
        await AuditService.log(
            AuditAction.GESTORIA_DOWNLOAD,
            AuditEntity.GESTORIA,
            logId,
            { action: 'download', periodId: logEntry.periodId },
            user.id
        );
    }
};
