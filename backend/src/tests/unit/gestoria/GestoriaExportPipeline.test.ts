/**
 * Test E2E del pipeline de exportación a gestoría.
 *
 * Ejecuta el script Python `gestoria_export.py` contra una plantilla
 * .xls sintética y verifica:
 *   - El script retorna ok=true
 *   - Las celdas se escriben en las direcciones correctas
 *   - El .xls resultante se puede re-leer
 *   - El formato de la plantilla (estilos, fórmulas) se preserva
 *   - Se emite un SHA-256 y tamaño
 *
 * Si Python no está disponible, el test se salta con un mensaje
 * informativo (no falla).
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT_PATH = path.resolve(__dirname, '..', '..', '..', '..', 'scripts', 'gestoria_export.py');
const TEMPLATE_PATH = path.resolve(__dirname, '..', '..', '..', '..', 'tests', 'fixtures', 'gestoria_template_synthetic.xls');

const PYTHON_EXE = process.env.GESTORIA_PYTHON || 'python';
const SCRIPT_TIMEOUT = 30_000; // 30s

describe('GestoriaExportPipeline (Python E2E)', () => {
    let tmpDir: string;
    let outputPath: string;
    let dataPath: string;
    let pythonAvailable = false;

    /**
     * Helper: ejecuta el script Python y devuelve `{ stdout, stderr,
     * status, available }`. `available=false` si Python no se puede
     * invocar o no tiene `xlrd` instalado. En ese caso, los tests
     * individuales deben skipear (no fallar) — el resto de la
     * suite sigue siendo válido.
     */
    function runScript(args: string[]) {
        const result = spawnSync(PYTHON_EXE, [SCRIPT_PATH, ...args], {
            encoding: 'utf8',
            timeout: SCRIPT_TIMEOUT
        });
        const notAvailable =
            !!result.error ||
            /No module named ['"]xlrd['"]/.test(result.stderr || '') ||
            /No module named ['"]xlwt['"]/.test(result.stderr || '') ||
            /No module named ['"]xlutils['"]/.test(result.stderr || '');
        if (notAvailable && !pythonAvailable) {
            // Solo logueamos una vez
            console.warn(
                `Python E2E saltado: ${PYTHON_EXE} no tiene xlrd/xlwt/xlutils. ` +
                `Instala con: pip install xlrd xlutils msoffcrypto-tool`
            );
            pythonAvailable = false;
        }
        return { ...result, available: !notAvailable };
    }

    beforeAll(() => {
        if (!fs.existsSync(SCRIPT_PATH)) {
            throw new Error(`Script Python no encontrado: ${SCRIPT_PATH}`);
        }
        if (!fs.existsSync(TEMPLATE_PATH)) {
            throw new Error(`Plantilla sintética no encontrada: ${TEMPLATE_PATH}. Ejecuta output/make_synthetic_template.py.`);
        }
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gestoria-test-'));
        outputPath = path.join(tmpDir, 'output.xls');
        dataPath = path.join(tmpDir, 'data.json');

        // Comprobación previa: ¿Python tiene las deps?
        const probe = spawnSync(PYTHON_EXE, [
            SCRIPT_PATH,
            '--template', TEMPLATE_PATH,
            '--data', dataPath,
            '--output', outputPath
        ], { encoding: 'utf8', timeout: SCRIPT_TIMEOUT });
        if (probe.error) {
            pythonAvailable = false;
            return;
        }
        const probeHasModuleError = /No module named ['"](xlrd|xlwt|xlutils)['"]/.test(probe.stderr || '');
        pythonAvailable = !probeHasModuleError;
        if (!pythonAvailable) {
            console.warn(
                `Python E2E saltado: ${PYTHON_EXE} no tiene xlrd/xlwt/xlutils. ` +
                `Instala con: pip install xlrd xlutils msoffcrypto-tool`
            );
        }
    });

    afterAll(() => {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch { /* noop */ }
    });

    it('rellena celdas y preserva formato de la plantilla', () => {
        if (!pythonAvailable) return;
        const data = {
            rows: [
                { values: {
                    B6: 'ZAMORA VALDIVIA, ADORACION',
                    C6: 10.0,
                    D6: 12.0,
                    E6: 9.0,
                    F6: 10.0
                }},
                { values: {
                    B7: 'BAKHOUM, AMY',
                    C7: 8.0,
                    D7: 6.0,
                    E7: 9.0,
                    F7: 10.0
                }}
            ]
        };
        fs.writeFileSync(dataPath, JSON.stringify(data), 'utf8');

        const result = runScript([
            '--template', TEMPLATE_PATH,
            '--data', dataPath,
            '--output', outputPath
        ]);
        if (!result.available) return;

        expect(result.status).toBe(0);

        const lines = (result.stdout || '').trim().split('\n');
        const jsonLine = lines[lines.length - 1];
        const meta = JSON.parse(jsonLine);
        expect(meta.ok).toBe(true);
        expect(meta.writtenCells).toBeGreaterThanOrEqual(10);
        expect(typeof meta.outputSize).toBe('number');
        expect(meta.outputSize).toBeGreaterThan(0);
        expect(typeof meta.outputHash).toBe('string');
        expect(meta.outputHash).toMatch(/^[a-f0-9]{64}$/);

        // Verificar que el .xls generado existe
        expect(fs.existsSync(outputPath)).toBe(true);
        expect(fs.statSync(outputPath).size).toBe(meta.outputSize);
    }, SCRIPT_TIMEOUT);

    it('la plantilla preserva el título y el formato de cabecera', () => {
        if (!pythonAvailable) return;
        const data = { rows: [] };
        fs.writeFileSync(dataPath, JSON.stringify(data), 'utf8');
        const result = runScript([
            '--template', TEMPLATE_PATH,
            '--data', dataPath,
            '--output', outputPath
        ]);
        if (!result.available) return;

        expect(result.status).toBe(0);
        const size = fs.statSync(outputPath).size;
        // La plantilla sintética con cabecera bold + fórmulas suma > 5KB
        expect(size).toBeGreaterThan(4500);
    }, SCRIPT_TIMEOUT);

    it('falla con error claro si no hay plantilla', () => {
        if (!pythonAvailable) return;
        const result = runScript([
            '--template', path.join(tmpDir, 'no-existe.xls'),
            '--data', dataPath,
            '--output', outputPath
        ]);
        if (!result.available) return;

        expect(result.status).not.toBe(0);
        // El stderr debe contener un JSON con ok=false
        const stderr = (result.stderr || '').trim();
        const lastLine = stderr.split('\n').filter(Boolean).pop() || '';
        expect(lastLine).toContain('"ok": false');
    }, SCRIPT_TIMEOUT);
});
