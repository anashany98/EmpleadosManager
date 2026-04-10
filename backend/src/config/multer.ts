import multer from 'multer';
import path from 'path';
import { validateFileSignature, isPdf, isExcel, isOfficeDoc } from '../utils/fileValidation';
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
            fileSize: 10 * 1024 * 1024,
        },
    };
};

export const createSecureMulterOptions = (
    dest: string,
    allowedExtensions: string[] = ['.pdf', '.jpg', '.jpeg', '.png'],
    allowedMimeTypes: string[] = ['application/pdf', 'image/jpeg', 'image/png']
) => {
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, dest);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, uniqueSuffix + ext);
        }
    });

    const fileFilter = async (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        const ext = path.extname(file.originalname).toLowerCase();

        if (!allowedExtensions.includes(ext)) {
            return cb(new Error(`Extensión no permitida: ${ext}`));
        }

        const firstBytes = file.buffer.slice(0, 8);
        
        try {
            validateFileSignature(firstBytes, ext);
            cb(null, true);
        } catch (error) {
            return cb(new AppError('El contenido del archivo no coincide con su extensión', 400));
        }
    };

    return {
        storage,
        fileFilter,
        limits: {
            fileSize: 10 * 1024 * 1024,
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