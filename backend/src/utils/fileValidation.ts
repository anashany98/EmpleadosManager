import { AppError } from './AppError';

interface FileSignature {
    magicBytes: Buffer;
    offset: number;
    mimeType: string;
    extension: string;
}

const FILE_SIGNATURES: FileSignature[] = [
    {
        magicBytes: Buffer.from([0x25, 0x50, 0x44, 0x46]),
        offset: 0,
        mimeType: 'application/pdf',
        extension: '.pdf'
    },
    {
        magicBytes: Buffer.from([0xFF, 0xD8, 0xFF]),
        offset: 0,
        mimeType: 'image/jpeg',
        extension: '.jpg'
    },
    {
        magicBytes: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        offset: 0,
        mimeType: 'image/png',
        extension: '.png'
    },
    {
        magicBytes: Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]),
        offset: 0,
        mimeType: 'application/vnd.ms-office',
        extension: '.doc'
    },
    {
        magicBytes: Buffer.from([0x50, 0x4B, 0x03, 0x04]),
        offset: 0,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: '.xlsx'
    },
    {
        magicBytes: Buffer.from([0x50, 0x4B, 0x03, 0x04]),
        offset: 0,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: '.docx'
    },
    {
        magicBytes: Buffer.from([0x1F, 0x8B, 0x08]),
        offset: 0,
        mimeType: 'application/gzip',
        extension: '.gz'
    },
    {
        magicBytes: Buffer.from([0x42, 0x4D]),
        offset: 0,
        mimeType: 'image/bmp',
        extension: '.bmp'
    },
    {
        magicBytes: Buffer.from([0x47, 0x49, 0x46, 0x38]),
        offset: 0,
        mimeType: 'image/gif',
        extension: '.gif'
    },
    {
        magicBytes: Buffer.from([0x00, 0x00, 0x01, 0x00]),
        offset: 0,
        mimeType: 'image/x-icon',
        extension: '.ico'
    }
];

export function validateFileSignature(buffer: Buffer, extension: string): string {
    if (buffer.length < 4) {
        throw new AppError('Archivo demasiado pequeño para validar', 400);
    }

    const normalizedExt = extension.toLowerCase();

    for (const sig of FILE_SIGNATURES) {
        if (normalizedExt === sig.extension) {
            const slice = buffer.slice(sig.offset, sig.offset + sig.magicBytes.length);
            if (slice.equals(sig.magicBytes)) {
                return sig.mimeType;
            }
            throw new AppError(`El archivo tiene extensión ${extension} pero el contenido no coincide`, 400);
        }
    }

    throw new AppError('Tipo de archivo no válido', 400);
}

export function validateImageMagicBytes(buffer: Buffer): boolean {
    const imageSignatures = FILE_SIGNATURES.filter(s => 
        s.mimeType.startsWith('image/')
    );

    for (const sig of imageSignatures) {
        const slice = buffer.slice(sig.offset, sig.offset + sig.magicBytes.length);
        if (slice.equals(sig.magicBytes)) {
            return true;
        }
    }

    return false;
}

export function isPdf(buffer: Buffer): boolean {
    const pdfSig = FILE_SIGNATURES.find(s => s.mimeType === 'application/pdf');
    if (!pdfSig) return false;
    
    const slice = buffer.slice(0, pdfSig.magicBytes.length);
    return slice.equals(pdfSig.magicBytes);
}

export function isExcel(buffer: Buffer): boolean {
    const excelSigs = FILE_SIGNATURES.filter(s => 
        s.mimeType.includes('spreadsheet') || s.extension === '.xls'
    );

    for (const sig of excelSigs) {
        const slice = buffer.slice(sig.offset, sig.offset + sig.magicBytes.length);
        if (slice.equals(sig.magicBytes)) {
            return true;
        }
    }

    return false;
}

export function isOfficeDoc(buffer: Buffer): boolean {
    const docSigs = FILE_SIGNATURES.filter(s =>
        s.mimeType.includes('office') || s.mimeType.includes('word')
    );

    for (const sig of docSigs) {
        const slice = buffer.slice(sig.offset, sig.offset + sig.magicBytes.length);
        if (slice.equals(sig.magicBytes)) {
            return true;
        }
    }

    return false;
}

// WebP magic: "RIFF....WEBP". Solo nos interesa el prefijo RIFF y el sufijo
// WEBP en los primeros 12 bytes; el tamaño中间的中间 4 bytes puede variar.
export function isWebp(buffer: Buffer): boolean {
    if (buffer.length < 12) return false;
    const riff = buffer.slice(0, 4).toString('ascii');
    const webp = buffer.slice(8, 12).toString('ascii');
    return riff === 'RIFF' && webp === 'WEBP';
}

/**
 * Valida un SVG contra patrones XSS comunes. Los SVG son texto plano y no
 * tienen magic bytes, pero pueden contener <script>, on* handlers o
 * javascript: URIs. Esto NO es un reemplazo de un sanitizer XML completo;
 * es una primera barrera para bloquear payloads obvios. Para SVG que se
 * sirven al frontend, debería además usarse DOMPurify.
 */
export function isSafeSvg(buffer: Buffer): boolean {
    if (buffer.length < 5) return false;
    const head = buffer.slice(0, 256).toString('utf8', 0, 256).trim().toLowerCase();
    // Debe empezar por declaración XML o etiqueta <svg
    if (!head.startsWith('<?xml') && !head.startsWith('<svg')) {
        return false;
    }
    const fullText = buffer.toString('utf8', 0, Math.min(buffer.length, 64 * 1024)).toLowerCase();
    // Bloqueos básicos: <script>, handlers de eventos on* y javascript: URIs
    if (/<script\b/.test(fullText)) return false;
    if (/\son[a-z]+\s*=/.test(fullText)) return false;
    if (/javascript\s*:/.test(fullText)) return false;
    return true;
}