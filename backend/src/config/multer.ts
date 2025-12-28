import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const createMulterOptions = (dest: string, allowedExtensions: string[] = ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.xls']) => {
    // Ensure directory exists
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, dest);
        },
        filename: (req, file, cb) => {
            const cleanName = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, `${uniqueSuffix}-${cleanName}`);
        },
    });

    const fileFilter = (req: any, file: any, cb: any) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
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
