import multer from 'multer';
import path from 'path';

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
    // Memory storage: we upload buffers to S3 or local storage in controllers/services
    const storage = multer.memoryStorage();

    const fileFilter = (req: any, file: any, cb: any) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const mimeOk = allowedMimeTypes.includes(file.mimetype);
        if (allowedExtensions.includes(ext) && mimeOk) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de archivo no permitido. Permitidos: ${allowedExtensions.join(', ')}`), false);
        }
    };

    return {
        storage,
        fileFilter,
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB default
        },
    };
};
