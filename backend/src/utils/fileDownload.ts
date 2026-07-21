import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { ApiResponse } from './ApiResponse';
import { createLogger } from '../services/LoggerService';

const log = createLogger('fileDownload');

/**
 * Resolved absolute path of the local uploads directory, evaluated
 * at call time (NOT module load) so that `process.cwd()` changes
 * in tests are honoured. Matches the value used by
 * `StorageService` for the local provider; the two MUST stay in
 * sync.
 */
function getLocalUploadDir(): string {
    return path.resolve(process.cwd(), 'uploads');
}

/**
 * Sanitiza un nombre de archivo para usarlo en el header
 * `Content-Disposition`. Devuelve dos versiones:
 *
 *   - `ascii`: versión "limpia" solo con caracteres ASCII, que
 *     metemos en el parámetro `filename=` (compatible con clientes
 *     antiguos que no entienden RFC 5987).
 *   - `utf8`: versión UTF-8 completa, lista para
 *     `encodeURIComponent` en el parámetro `filename*=UTF-8''...`
 *     (RFC 6266 + RFC 5987).
 *
 * Esto evita header injection cuando el nombre del documento
 * contiene comillas, saltos de línea o caracteres no-ASCII
 * (típico en nombres reales: "seguro \"coche\" 2024.pdf",
 * "factura Müller.pdf", etc.).
 *
 * Si el nombre está vacío, solo tiene caracteres de control o
 * queda visualmente inútil tras la sanitización (p.ej. solo
 * underscores), devuelve un fallback seguro ("documento").
 */
export function sanitizeContentDispositionFilename(
    raw: string | null | undefined
): { ascii: string; utf8: string } {
    const fallback = { ascii: 'documento', utf8: 'documento' };
    if (!raw) return fallback;
    const trimmed = raw.trim();
    if (!trimmed) return fallback;

    // Quitar caracteres de control (0x00-0x1F, 0x7F) y comillas
    // que romperían el header. Mantener tildes, eñes, etc.
    const utf8 = trimmed.replace(/[\x00-\x1F\x7F"\\]/g, '_');

    // Versión ASCII: solo letras/dígitos/espacios/puntos/guion/
    // guion_bajo. Si queda vacía o solo underscores/puntos,
    // fallback.
    const ascii = utf8
        .replace(/[^\x20-\x7E]/g, '_')
        .replace(/["\\]/g, '_')
        .trim();
    const isAsciiEmpty = !ascii;
    const isAsciiUseless = /^[_.\s]+$/.test(ascii);
    if (isAsciiEmpty || isAsciiUseless) {
        return fallback;
    }
    return { ascii, utf8 };
}

/**
 * Resuelve la ruta absoluta de un archivo dentro del directorio
 * `uploads/` con verificación de contención (defense-in-depth
 * contra path traversal).
 *
 * El input `fileUrl` es típicamente la `key` que devuelve
 * `StorageService.saveBuffer` (algo como
 * `"documents/1718900000000-123456789.pdf"`), pero el contrato
 * público de esta función es: "dame una ruta de un string,
 * garantizando que está dentro de `uploads/`". Si el string
 * contiene `..`, rutas absolutas, o caracteres NUL que
 * `path.basename` neutralizaría pero `path.resolve` propagaría,
 * devolvemos `null` y el caller devuelve 404.
 *
 * Defense-in-depth: aunque `StorageService.makeKey` ya sanea la
 * key en el momento de escribirla a BD, un atacante que
 * compromete la BD (SQL injection, admin malicioso) podría
 * inyectar una `fileUrl` con `..`. Este check es la segunda
 * barrera.
 */
export function resolveLocalUploadPath(fileUrl: string | null | undefined): string | null {
    if (typeof fileUrl !== 'string' || !fileUrl) return null;
    // path.resolve ignora los segmentos vacíos; pero un input con
    // solo whitespace no debería pasar.
    if (!fileUrl.trim()) return null;

    // Normalizar: tolerar DOS convenciones que coexisten en la BD:
    //   1. `/uploads/vehicle-documents/abc.pdf`  (algunos controllers
    //      guardan con el prefijo `/uploads/`)
    //   2. `documents/abc.pdf`                  (otros guardan solo
    //      la key relativa)
    // En ambos casos la ruta real en disco es
    // `<uploads>/vehicle-documents/abc.pdf`. Strippeamos el
    // prefijo opcional.
    const normalized = fileUrl.replace(/^[/\\]+/, '').replace(/^uploads[/\\]/i, '');

    // path.basename neutraliza los `..` y los separadores. Pero
    // queremos permitir subcarpetas legítimas (`documents/abc.pdf`),
    // así que NO usamos basename aquí. En su lugar, resolvemos
    // la ruta completa y verificamos contención con el separador
    // para evitar ataques de prefijo (e.g. `uploads-evil/...`).
    const resolved = path.resolve(getLocalUploadDir(), normalized);

    // El archivo tiene que estar estrictamente dentro del
    // directorio de uploads. Usamos el separador para evitar
    // que `uploads-evil/foo` pase un `startsWith('uploads')`.
    const localUploadDir = getLocalUploadDir();
    if (
        resolved !== localUploadDir
        && !resolved.startsWith(localUploadDir + path.sep)
    ) {
        return null;
    }
    return resolved;
}

export interface ServeLocalFileOptions {
    /**
     * Filename visible para el usuario (Content-Disposition).
     * Si se omite, se usa el basename de la ruta resuelta (típico
     * cuando el nombre en BD es un UUID generado por Multer y no
     * necesita aparecer en el download). Se saneará con
     * `sanitizeContentDispositionFilename` (RFC 6266 + 5987).
     */
    downloadName?: string;
    /**
     * Si es `true`, sirve con `Content-Disposition: inline`
     * (visualizar en navegador en lugar de forzar download).
     * Default: `false` (attachment).
     */
    inline?: boolean;
}

/**
 * Sirve un archivo local del directorio `uploads/` con protección
 * contra path traversal, sanitización del nombre de descarga
 * (sin header injection), callback de error explícito en
 * `res.sendFile` (404 en ENOENT, 500 controlado en otros errores)
 * y log estructurado de fallos de stream.
 *
 * Uso:
 *   serveLocalUploadFile(res, document.fileUrl, { downloadName: document.name });
 *   serveLocalUploadFile(res, fileUrl, { inline: true });
 *
 * Si el archivo no existe, la key escapa de `uploads/`, o el
 * stream falla con ENOENT, responde 404 con mensaje claro. Otros
 * errores de stream → 500 con mensaje genérico (no se filtra el
 * detalle de la excepción al cliente).
 */
export function serveLocalUploadFile(
    res: Response,
    fileUrl: string | null | undefined,
    options: ServeLocalFileOptions = {}
): void {
    const filePath = resolveLocalUploadPath(fileUrl);
    if (!filePath) {
        ApiResponse.error(res, 'Archivo no encontrado', 404);
        return;
    }

    if (!fs.existsSync(filePath)) {
        ApiResponse.error(res, 'Archivo no encontrado', 404);
        return;
    }

    const displayName = sanitizeContentDispositionFilename(
        options.downloadName ?? path.basename(filePath)
    );
    const dispositionType = options.inline ? 'inline' : 'attachment';
    res.setHeader(
        'Content-Disposition',
        `${dispositionType}; filename="${displayName.ascii}"; filename*=UTF-8''${encodeURIComponent(displayName.utf8)}"`
    );

    res.sendFile(filePath, (err: NodeJS.ErrnoException | null) => {
        if (!err) return;
        log.warn({ filePath, code: err?.code, message: err?.message }, 'sendFile failed during local file download');
        // Si los headers ya se enviaron (caso típico: race con
        // delete concurrente entre el fs.existsSync y el stream),
        // no podemos cambiar el status. Abortamos la respuesta.
        if (res.headersSent) {
            res.destroy();
            return;
        }
        if (err?.code === 'ENOENT') {
            ApiResponse.error(res, 'Archivo no encontrado', 404);
            return;
        }
        // Cualquier otro error: 500 genérico, sin filtrar el
        // detalle de la excepción (que podría incluir paths
        // internos de Express/Multer).
        ApiResponse.error(res, 'Error al servir el archivo', 500);
    });
}
