import path from 'path';
import { prisma } from '../../lib/prisma';
import { StorageService } from '../StorageService';
import { AuditService } from '../AuditService';
import { createLogger } from '../LoggerService';
import crypto from 'crypto';

const log = createLogger('DocumentSignService');

/**
 * Actor mínimo para autorización. Sigue el patrón de los demás
 * servicios (SchedulerActor, etc.) para mantener consistencia.
 */
export interface SignActor {
    id: string;
    role?: string;
    companyId?: string | null;
    employeeId?: string | null;
}

/**
 * Límite de tamaño del PNG de la firma tras decodificar base64.
 * 2 MB es suficiente para una firma manuscrita digitalizada a 600dpi
 * en formato A4 parcial, y blinda contra payloads enormes que
 * podrían tumbar pdf-lib o el pool de workers.
 */
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

const DATA_URL_RE = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;

const ALLOWED_KEY_RE = /^(?!.*\.\.)[a-zA-Z0-9][a-zA-Z0-9._\-/]*$/;

function isGlobalAdmin(actor: SignActor | null | undefined): boolean {
    return !!actor && actor.role === 'admin' && !actor.companyId;
}

function assertKeySafe(key: string): void {
    if (!key || typeof key !== 'string') {
        throw new Error('La clave del documento es inválida');
    }
    // Bloquea path traversal y absolutos
    if (key.includes('..') || key.startsWith('/') || key.startsWith('\\') || /^[a-zA-Z]:[\\/]/.test(key)) {
        throw new Error('La clave del documento sale del namespace permitido (path traversal)');
    }
    if (!ALLOWED_KEY_RE.test(key)) {
        throw new Error('La clave del documento contiene caracteres no permitidos');
    }
}

function assertValidSignatureDataUrl(dataUrl: string): { buffer: Buffer } {
    if (typeof dataUrl !== 'string') {
        throw new Error('La firma debe ser una cadena');
    }
    const match = DATA_URL_RE.exec(dataUrl);
    if (!match) {
        throw new Error('La firma debe ser una imagen PNG en formato data URL base64');
    }
    const buffer = Buffer.from(match[1], 'base64');
    if (buffer.length === 0) {
        throw new Error('La firma está vacía');
    }
    if (buffer.length > MAX_SIGNATURE_BYTES) {
        throw new Error(`La firma excede el tamaño máximo permitido (${MAX_SIGNATURE_BYTES} bytes)`);
    }
    // Comprobación rápida de magic bytes PNG (\x89PNG\r\n\x1a\n)
    if (
        buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47
    ) {
        throw new Error('La firma no es un PNG válido (magic bytes incorrectos)');
    }
    return { buffer };
}

/**
 * Firma un documento.
 *
 * CRIT-004 — el bug original:
 *   - Aceptaba cualquier documentId sin comprobar tenant.
 *   - Leía el archivo con `path.join(cwd, 'uploads', document.fileUrl)`
 *     y `fs.readFileSync` directo, sin confinar la clave → un fileUrl
 *     con `../` podía leer fuera de `uploads/`.
 *   - No validaba la data URL de la firma (tamaño/formato).
 *   - El path S3 lanzaba "only supported on local storage", dejando
 *     la función inútil en producción si STORAGE_PROVIDER=s3.
 *   - Sin audit log ni transacción compensable.
 *
 * El fix:
 *   1) Carga el documento con su employee y exige `companyId` del
 *      tenant del actor (o admin global).
 *   2) Lee el PDF origen con `StorageService.getBuffer` (que ya
 *      confina la clave al namespace del proveedor).
 *   3) Valida la clave origen con `assertKeySafe` como segunda línea
 *      de defensa (defense in depth).
 *   4) Valida la firma con `assertValidSignatureDataUrl` (formato
 *      PNG, magic bytes, tamaño máximo).
 *   5) Guarda el PDF firmado y crea el `Document` con
 *      `prisma.$transaction`. Si la creación falla, borra el PDF
 *      firmado del storage (rollback compensatorio).
 *   6) Audit log con actor, tenant y SHA-256 del PDF firmado.
 */
export const signDocument = async (
    documentId: string,
    signatureDataUrl: string,
    actor: SignActor
): Promise<any> => {
    if (!actor || !actor.id) {
        throw new Error('Se requiere un actor autenticado');
    }

    const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: { employee: { select: { id: true, companyId: true } } }
    });

    if (!document) {
        // 404 uniforme — no enumerar IDs ajenos
        throw new Error('Documento no encontrado');
    }

    // CRIT-004 — autorización por tenant
    if (!isGlobalAdmin(actor)) {
        if (!actor.companyId) {
            throw new Error('El usuario no tiene una empresa asignada');
        }
        const docCompany = document.employee?.companyId;
        if (!docCompany || docCompany !== actor.companyId) {
            log.warn(
                { documentId, actorId: actor.id, docCompany, actorCompany: actor.companyId },
                'Cross-tenant document sign blocked'
            );
            // 404 uniforme en vez de 403 para no enumerar
            throw new Error('Documento no encontrado');
        }
    }

    // CRIT-004 — defensa contra path traversal
    assertKeySafe(document.fileUrl);

    // CRIT-004 — data URL validada antes de tocar pdf-lib
    assertValidSignatureDataUrl(signatureDataUrl);

    // CRIT-004 — lectura segura por StorageService (no fs directo)
    const pdfBytes = await StorageService.getBuffer(document.fileUrl);

    const { PDFDocument: PDFLibDocument } = await import('pdf-lib');
    const pdfDoc = await PDFLibDocument.load(pdfBytes);
    const signatureImage = await pdfDoc.embedPng(signatureDataUrl);

    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
        throw new Error('El PDF no tiene páginas para firmar');
    }
    const firstPage = pages[0];
    firstPage.drawImage(signatureImage, {
        x: 350,
        y: 80,
        width: 150,
        height: 50
    });

    const finalPdfBytes = await pdfDoc.save();
    const finalBuffer = Buffer.from(finalPdfBytes);
    const signedHash = crypto.createHash('sha256').update(finalBuffer).digest('hex');

    const fileName = `FIRMADO_${document.name.replace(/\.pdf$/i, '')}_${Date.now()}.pdf`;
    const { key } = await StorageService.saveBuffer({
        folder: `documents/EXP_${document.employeeId}`,
        originalName: fileName,
        buffer: finalBuffer,
        contentType: 'application/pdf'
    });

    let signedDoc;
    try {
        // CRIT-004 — transacción Prisma para atomicidad BD+storage
        signedDoc = await prisma.$transaction(async (tx) => {
            const doc = await tx.document.create({
                data: {
                    employeeId: document.employeeId,
                    name: `FIRMADO: ${document.name}`,
                    category: document.category,
                    fileUrl: key,
                    expiryDate: document.expiryDate
                }
            });
            return doc;
        });
    } catch (error) {
        // Rollback compensatorio: si la BD falló, borramos el PDF firmado
        await StorageService.deleteFile(key).catch((delErr) => {
            log.error(
                { err: delErr, key },
                'No se pudo borrar el PDF firmado del storage tras fallo de BD'
            );
        });
        throw error;
    }

    // CRIT-004 — audit log con hash del PDF firmado
    await AuditService.log(
        'DOCUMENT_SIGN',
        'DOCUMENT',
        documentId,
        {
            signedDocumentId: signedDoc.id,
            signedKey: key,
            signedSha256: signedHash,
            employeeId: document.employeeId,
            employeeCompanyId: document.employee?.companyId,
            actorId: actor.id,
            actorCompanyId: actor.companyId ?? null
        },
        actor.id
    ).catch((err) => {
        // No fallamos la operación si el audit falla, pero lo registramos
        log.error({ err, documentId, signedDocId: signedDoc.id }, 'Audit log failed for document sign');
    });

    log.info(
        { documentId, signedDocumentId: signedDoc.id, signedHash, actorId: actor.id },
        'Document signed successfully'
    );

    return signedDoc;
};
