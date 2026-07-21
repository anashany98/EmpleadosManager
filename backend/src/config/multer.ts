import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
    isPdf,
    isExcel,
    isOfficeDoc,
    isWebp,
    isSafeSvg,
    validateFileSignature
} from '../utils/fileValidation';
import { AppError } from '../utils/AppError';

export const createMulterOptions = (
    _dest: string,
    allowedExtensions: string[] = ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.xls'],
    allowedMimeTypes: string[] = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
    ]
) => {
    const storage = multer.memoryStorage();

    const fileFilter = (req: any, file: any, cb: any) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const mimeOk = allowedMimeTypes.includes(file.mimetype);
        
        if (!allowedExtensions.includes(ext)) {
            return cb(new Error(`Extensión no permitida: ${ext}. Permitidos: ${allowedExtensions.join(', ')}`), false);
        }

        if (!mimeOk) {
            return cb(new Error(`Tipo MIME no permitido: ${file.mimetype}`), false);
        }

        cb(null, true);
    };

    return {
        storage,
        fileFilter,
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB max (reduced from 10MB for memory safety)
        },
    };
};

export const createSecureMulterOptions = (
    _dest: string,
    allowedExtensions: string[] = ['.pdf', '.jpg', '.jpeg', '.png'],
    allowedMimeTypes: string[] = ['application/pdf', 'image/jpeg', 'image/png']
) => {
    // Use memoryStorage so file.buffer is available for magic-byte validation
    const storage = multer.memoryStorage();

    const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        const ext = path.extname(file.originalname).toLowerCase();

        if (!allowedExtensions.includes(ext)) {
            return cb(new Error(`Extensión no permitida: ${ext}`));
        }

        if (!allowedMimeTypes.includes(file.mimetype)) {
            return cb(new Error(`Tipo MIME no permitido: ${file.mimetype}`));
        }

        cb(null, true);
    };

    return {
        storage,
        fileFilter,
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB max (reduced from 10MB for memory safety)
        },
    };
};

export const validateUpload = (file: Express.Multer.File): void => {
    const ext = path.extname(file.originalname).toLowerCase();
    const buffer = file.buffer;

    if (ext === '.pdf' && !isPdf(buffer)) {
        throw new AppError('El archivo no es un PDF válido', 400);
    }

    if ((ext === '.xlsx' || ext === '.xls') && !isExcel(buffer)) {
        throw new AppError('El archivo no es un Excel válido', 400);
    }

    if ((ext === '.doc' || ext === '.docx') && !isOfficeDoc(buffer)) {
        throw new AppError('El archivo no es un documento de Office válido', 400);
    }
};

/**
 * Variante para multer configurado con `diskStorage`: el archivo ya está
 * escrito en disco cuando se invoca la validación. Esta función:
 *   1) abre el archivo en disco,
 *   2) lee los primeros ~64 KB (suficiente para todos los magic bytes),
 *   3) compara contra la firma esperada según la extensión declarada,
 *   4) si no coincide, BORRA el archivo del disco y lanza AppError 400.
 *
 * Pensada para invocarse como middleware justo después de `upload.single(...)`
 * en routes que aún dependen del path/filename (p.ej. controllers que hacen
 * `fs.renameSync(req.file.path, targetPath)`).
 *
 * Diferencia con `validateUpload()` (que trabaja sobre `file.buffer`):
 * esta evita cargar el archivo entero en memoria cuando multer lo ha
 * dejado en disco.
 */
export const validateUploadFromPath = (file: Express.Multer.File): void => {
    if (!file?.path) {
        throw new AppError('No se recibió ningún archivo para validar', 400);
    }

    const ext = path.extname(file.originalname).toLowerCase();

    // Lee solo la cabecera del archivo (64 KB) — más que suficiente para
    // cualquier magic byte conocido y más rápido que volcar el archivo.
    let buffer: Buffer;
    try {
        const fd = fs.openSync(file.path, 'r');
        try {
            const stat = fs.fstatSync(fd);
            const readSize = Math.min(stat.size, 64 * 1024);
            buffer = Buffer.alloc(readSize);
            fs.readSync(fd, buffer, 0, readSize, 0);
        } finally {
            fs.closeSync(fd);
        }
    } catch (err) {
        throw new AppError('No se pudo leer el archivo subido para validarlo', 400);
    }

    let valid = true;
    try {
        switch (ext) {
            case '.pdf':
                valid = isPdf(buffer);
                break;
            case '.xlsx':
            case '.xls':
                valid = isExcel(buffer);
                break;
            case '.doc':
            case '.docx':
                valid = isOfficeDoc(buffer);
                break;
            case '.webp':
                valid = isWebp(buffer);
                break;
            case '.svg':
                valid = isSafeSvg(buffer);
                break;
            case '.jpg':
            case '.jpeg':
            case '.png':
            case '.bmp':
            case '.gif':
            case '.ico':
                // validateFileSignature además de devolver el MIMEtype lanza
                // AppError si la firma no coincide; lo capturamos.
                try {
                    validateFileSignature(buffer, ext);
                } catch {
                    valid = false;
                }
                break;
            default:
                valid = false;
        }
    } catch {
        valid = false;
    }

    if (!valid) {
        // Borrado best-effort: si falla el unlink, no bloqueamos el 400,
        // pero lo dejamos en el log para limpieza manual.
        try {
            fs.unlinkSync(file.path);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn(`[multer] No se pudo borrar archivo inválido: ${file.path}`, err);
        }
        throw new AppError(
            `El archivo tiene extensión ${ext} pero su contenido no coincide. Posible subida maliciosa.`,
            400
        );
    }
};

/**
 * Helper Express: middleware para encadenar tras `upload.single(...)`
 * o `upload.array(...)` en routes que usan diskStorage. Valida cada
 * archivo recibido y borra los inválidos del disco.
 */
function runValidateUpload(
    req: any,
    _res: any,
    next: any,
    fieldName?: string
): void {
    try {
        if (fieldName && req.file?.fieldname === fieldName) {
            validateUploadFromPath(req.file);
            return next();
        }
        if (!fieldName && req.file) {
            validateUploadFromPath(req.file);
            return next();
        }
        if (Array.isArray(req.files) && req.files.length > 0) {
            req.files.forEach(validateUploadFromPath);
            return next();
        }
        next();
    } catch (err) {
        next(err);
    }
}

export const validateDiskUploadMiddleware = (
    fieldName?: string
): ((req: any, res: any, next: any) => void) => (req, res, next) =>
    runValidateUpload(req, res, next, fieldName);