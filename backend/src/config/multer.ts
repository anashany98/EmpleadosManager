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
            let finalPath = dest;

            // If employeeId is in the body, we create a subfolder for that employee
            // Note: Frontend must send employeeId BEFORE the file in FormData
            if (req.body && req.body.employeeId) {
                finalPath = path.join(dest, `EXP_${req.body.employeeId}`);
            }

            if (!fs.existsSync(finalPath)) {
                fs.mkdirSync(finalPath, { recursive: true });
            }
            cb(null, finalPath);
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
