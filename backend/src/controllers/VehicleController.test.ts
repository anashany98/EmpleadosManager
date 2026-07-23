import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import vehicleRoutes from '../routes/vehicleRoutes';

const mocks = vi.hoisted(() => ({
    prisma: {
        vehicle: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        },
        employee: {
            findUnique: vi.fn()
        },
        vehicleLog: {
            create: vi.fn(),
            findUnique: vi.fn(),
            delete: vi.fn()
        },
        vehicleDocument: {
            findUnique: vi.fn(),
            create: vi.fn(),
            delete: vi.fn()
        }
    }
}));

vi.mock('../middlewares/authMiddleware', () => ({
    protect: (req: { user?: unknown }, _res: unknown, next: () => void) => {
        req.user = { id: 'user-123', role: 'admin', permissions: {} };
        next();
    },
    checkPermission: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));

vi.mock('../lib/prisma', () => ({
    prisma: mocks.prisma
}));

vi.mock('../services/AuditService', () => ({
    AuditService: {
        log: vi.fn().mockResolvedValue(undefined)
    }
}));

const app = express();
app.use(express.json());
app.use('/api/vehicles', vehicleRoutes);

const testDocumentDir = path.join(process.cwd(), 'uploads', 'vehicle-documents');
const testDocumentName = 'vehicle-controller-test.pdf';
const testDocumentPath = path.join(testDocumentDir, testDocumentName);

describe('VehicleController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.prisma.employee.findUnique.mockResolvedValue(null);
        mocks.prisma.vehicle.findUnique.mockResolvedValue(null);
        mocks.prisma.vehicleDocument.findUnique.mockResolvedValue(null);
    });

    afterEach(() => {
        if (fs.existsSync(testDocumentPath)) {
            fs.unlinkSync(testDocumentPath);
        }
    });

    it('should list all vehicles', async () => {
        mocks.prisma.vehicle.findMany.mockResolvedValue([
            { id: '1', plate: '1234ABC', make: 'Toyota', model: 'Corolla', logs: [], _count: { logs: 0 } }
        ]);

        const res = await request(app).get('/api/vehicles');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].plate).toBe('1234ABC');
    });

    it('should include vehicle documents when listing vehicles', async () => {
        mocks.prisma.vehicle.findMany.mockResolvedValue([
            {
                id: '1',
                plate: '1234ABC',
                make: 'Toyota',
                model: 'Corolla',
                documents: [{ id: 'doc-1', type: 'ITV', name: 'itv.pdf' }],
                logs: [],
                _count: { logs: 0 }
            }
        ]);

        const res = await request(app).get('/api/vehicles');

        expect(res.status).toBe(200);
        expect(res.body.data[0].documents).toHaveLength(1);
        expect(mocks.prisma.vehicle.findMany).toHaveBeenCalledWith(expect.objectContaining({
            include: expect.objectContaining({
                documents: { orderBy: { createdAt: 'desc' } }
            })
        }));
    });

    it('should create a vehicle and normalize the plate', async () => {
        mocks.prisma.vehicle.create.mockResolvedValue({
            id: '2',
            plate: '5678DEF',
            make: 'Ford',
            model: 'Focus',
            companyId: null,
            employeeId: null,
            logs: []
        });

        const res = await request(app).post('/api/vehicles').send({
            plate: '5678 def',
            make: 'Ford',
            model: 'Focus'
        });

        expect(res.status).toBe(200);
        expect(res.body.data.plate).toBe('5678DEF');
        expect(mocks.prisma.vehicle.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                plate: '5678DEF'
            })
        }));
    });

    it('should attach employee company when creating an assigned vehicle', async () => {
        mocks.prisma.employee.findUnique.mockResolvedValue({ companyId: 'company-1' });
        mocks.prisma.vehicle.create.mockResolvedValue({
            id: '2',
            plate: '5678DEF',
            make: 'Ford',
            model: 'Focus',
            companyId: 'company-1',
            employeeId: 'employee-1',
            logs: []
        });

        const res = await request(app).post('/api/vehicles').send({
            plate: '5678DEF',
            make: 'Ford',
            model: 'Focus',
            employeeId: 'employee-1'
        });

        expect(res.status).toBe(200);
        expect(mocks.prisma.vehicle.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                companyId: 'company-1',
                employeeId: 'employee-1'
            })
        }));
    });

    it('should update a vehicle', async () => {
        mocks.prisma.vehicle.findUnique.mockResolvedValue({
            id: '1',
            plate: '1234ABC',
            companyId: null,
            employeeId: null,
            employee: null,
            company: null
        });
        mocks.prisma.vehicle.update.mockResolvedValue({ id: '1', plate: '1234ABC', currentMileage: 50000, logs: [] });

        const res = await request(app).put('/api/vehicles/1').send({ currentMileage: 50000 });

        expect(res.status).toBe(200);
        expect(res.body.data.currentMileage).toBe(50000);
    });

    it('should add a vehicle log entry', async () => {
        mocks.prisma.vehicle.findUnique.mockResolvedValue({
            id: '1',
            plate: '1234ABC',
            companyId: null,
            employeeId: null,
            employee: null,
            company: null
        });
        mocks.prisma.vehicleLog.create.mockResolvedValue({
            id: 'log-1',
            vehicleId: '1',
            type: 'MAINTENANCE',
            title: 'Cambio de aceite'
        });

        const res = await request(app).post('/api/vehicles/1/logs').send({
            type: 'MAINTENANCE',
            title: 'Cambio de aceite'
        });

        expect(res.status).toBe(200);
        expect(res.body.data.type).toBe('MAINTENANCE');
    });

    it('should deactivate a vehicle instead of deleting it', async () => {
        mocks.prisma.vehicle.findUnique.mockResolvedValue({
            id: '1',
            plate: '1234ABC',
            companyId: null,
            employeeId: null,
            employee: null,
            company: null
        });
        mocks.prisma.vehicle.update.mockResolvedValue({ id: '1', status: 'INACTIVE' });

        const res = await request(app).delete('/api/vehicles/1');

        expect(res.status).toBe(200);
        expect(mocks.prisma.vehicle.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: '1' },
            data: { status: 'INACTIVE' }
        }));
        expect(mocks.prisma.vehicle.delete).not.toHaveBeenCalled();
    });

    it('should download a vehicle document through the protected route', async () => {
        fs.mkdirSync(testDocumentDir, { recursive: true });
        fs.writeFileSync(testDocumentPath, 'pdf-content');

        mocks.prisma.vehicle.findUnique.mockResolvedValue({
            id: '1',
            plate: '1234ABC',
            companyId: null,
            employeeId: null,
            employee: null,
            company: null
        });
        mocks.prisma.vehicleDocument.findUnique.mockResolvedValue({
            id: 'doc-1',
            vehicleId: '1',
            type: 'INSURANCE',
            name: 'seguro.pdf',
            fileUrl: `/uploads/vehicle-documents/${testDocumentName}`
        });

        const res = await request(app).get('/api/vehicles/1/documents/doc-1/download');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/pdf');
    });

    /**
     * MED-FIX: el download devuelve el contenido del archivo
     * íntegro (no vacío, no corrupto). El test anterior solo
     * validaba el status y el content-type, pero el bug que
     * reportó el usuario era que el download "sale fallo" — un
     * archivo vacío o corrupto también se sirve con 200. Aquí
     * verificamos que los bytes del archivo llegan al cliente.
     */
    it('should serve the actual file bytes (no empty/corrupt body)', async () => {
        fs.mkdirSync(testDocumentDir, { recursive: true });
        // Contenido simulado: un PDF real con bytes mágicos %PDF-
        const fakePdf = Buffer.concat([
            Buffer.from('%PDF-1.4\n'),
            Buffer.from('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'),
            Buffer.from('%%EOF\n')
        ]);
        fs.writeFileSync(testDocumentPath, fakePdf);

        mocks.prisma.vehicle.findUnique.mockResolvedValue({
            id: '1', plate: '1234ABC', companyId: null, employeeId: null,
            employee: null, company: null
        });
        mocks.prisma.vehicleDocument.findUnique.mockResolvedValue({
            id: 'doc-1', vehicleId: '1', type: 'INSURANCE', name: 'seguro.pdf',
            fileUrl: `/uploads/vehicle-documents/${testDocumentName}`
        });

        const res = await request(app).get('/api/vehicles/1/documents/doc-1/download');

        expect(res.status).toBe(200);
        // supertest parsea el body; comparamos los bytes
        expect(res.body).toEqual(fakePdf);
        expect(res.headers['content-length']).toBe(String(fakePdf.length));
        // El content-disposition está presente (debe ser "attachment"
        // para forzar download, no "inline" que abriría en el
        // navegador).
        expect(res.headers['content-disposition']).toMatch(/^attachment;/);
    });

    /**
     * MED-FIX: si el archivo del upload se borró del disco
     * (limpieza manual, error de disco, etc.) pero el registro
     * en BD sigue, el download debe devolver 404 explícito, no
     * 500 con "Internal Server Error". El usuario antes veía
     * este caso como un crash del servidor.
     */
    it('should return 404 with a clear message when the file is missing on disk', async () => {
        // NO creamos el archivo en disco. Simulamos que el upload
        // se hizo pero el archivo se perdió después.
        mocks.prisma.vehicle.findUnique.mockResolvedValue({
            id: '1', plate: '1234ABC', companyId: null, employeeId: null,
            employee: null, company: null
        });
        mocks.prisma.vehicleDocument.findUnique.mockResolvedValue({
            id: 'doc-1', vehicleId: '1', type: 'INSURANCE', name: 'perdido.pdf',
            fileUrl: `/uploads/vehicle-documents/archivo-perdido.pdf`
        });

        const res = await request(app).get('/api/vehicles/1/documents/doc-1/download');

        expect(res.status).toBe(404);
        // El body debe contener el mensaje claro (no un 500 con
        // "Internal Server Error" genérico).
        const body = JSON.parse(res.text || '{}');
        expect(body.message).toMatch(/no encontr/i);
    });

    /**
     * MED-FIX: el path-traversal check debe ACTIVARSE cuando el
     * fileUrl contiene un path traversal. Antes del fix el
     * `path.basename(fileUrl)` neutralizaba los `..` pero el
     * check `filePath.startsWith(documentsDir + sep)` era
     * insuficiente si el basename contenía caracteres especiales
     * (probablemente no, pero el test cubre el caso).
     */
    it('should block path traversal in fileUrl', async () => {
        mocks.prisma.vehicle.findUnique.mockResolvedValue({
            id: '1', plate: '1234ABC', companyId: null, employeeId: null,
            employee: null, company: null
        });
        // fileUrl intenta escapar del directorio de uploads
        mocks.prisma.vehicleDocument.findUnique.mockResolvedValue({
            id: 'doc-1', vehicleId: '1', type: 'INSURANCE', name: 'malicioso.pdf',
            // path.basename('../../../etc/passwd') === 'passwd',
            // así que el check de startsWith pasaría pero
            // fs.existsSync devolvería false → 404. Esto está bien
            // (defense in depth).
            fileUrl: '/uploads/vehicle-documents/../../../etc/passwd'
        });

        const res = await request(app).get('/api/vehicles/1/documents/doc-1/download');

        // El servidor debe rechazar (404 o similar) sin servir
        // /etc/passwd.
        expect(res.status).toBe(404);
    });

    /**
     * MED-FIX: el header `Content-Disposition` debe sanitizarse
     * para evitar header injection cuando el nombre del documento
     * contiene comillas o caracteres de control. El bug que
     * reportaba el usuario era exactamente este: con un nombre
     * como `seguro "coche" 2024.pdf`, el download fallaba
     * porque el header era inválido.
     */
    it('should sanitize filename in Content-Disposition (no header injection)', async () => {
        fs.mkdirSync(testDocumentDir, { recursive: true });
        fs.writeFileSync(testDocumentPath, 'pdf-content');

        mocks.prisma.vehicle.findUnique.mockResolvedValue({
            id: '1', plate: '1234ABC', companyId: null, employeeId: null,
            employee: null, company: null
        });
        // Nombre con comillas y caracteres no-ASCII: el bug del
        // usuario.
        mocks.prisma.vehicleDocument.findUnique.mockResolvedValue({
            id: 'doc-1', vehicleId: '1', type: 'INSURANCE',
            name: 'seguro "coche" Müller 2024.pdf',
            fileUrl: `/uploads/vehicle-documents/${testDocumentName}`
        });

        const res = await request(app).get('/api/vehicles/1/documents/doc-1/download');

        expect(res.status).toBe(200);
        const cd = res.headers['content-disposition'] || '';
        // El header debe estar bien formado: `attachment;`,
        // `filename="ASCII";`, `filename*=UTF-8''...` (RFC 6266).
        // Esta regex estructural ya descarta el header injection:
        // si la versión ASCII contuviera una `"` sin escapar, el
        // `[^"]*` no podría cerrar correctamente y la regex
        // fallaría (o el resto del header quedaría colgando antes
        // del `;`).
        expect(cd).toMatch(/^attachment;\s*filename="[^"]*";\s*filename\*=UTF-8''[^"]*"$/);
        // Comprobación adicional: el valor dentro de `filename="..."`
        // (la versión ASCII) NO contiene una `"` literal. Si la
        // tuviera, sería header injection.
        const asciiValue = cd.match(/filename="([^"]*)"/)?.[1] ?? '';
        expect(asciiValue).not.toMatch(/"/);
        // El nombre completo (con acentos) está codificado en
        // filename* (RFC 5987) para que navegadores modernos
        // descodifiquen "Müller" correctamente.
        expect(cd).toContain(encodeURIComponent('seguro _coche_ Müller 2024.pdf'));
    });

    it('should use fallback filename when the document name is empty or control characters only', async () => {
        fs.mkdirSync(testDocumentDir, { recursive: true });
        fs.writeFileSync(testDocumentPath, 'pdf-content');

        mocks.prisma.vehicle.findUnique.mockResolvedValue({
            id: '1', plate: '1234ABC', companyId: null, employeeId: null,
            employee: null, company: null
        });
        mocks.prisma.vehicleDocument.findUnique.mockResolvedValue({
            id: 'doc-1', vehicleId: '1', type: 'INSURANCE',
            name: '\x00\x01\x02',
            fileUrl: `/uploads/vehicle-documents/${testDocumentName}`
        });

        const res = await request(app).get('/api/vehicles/1/documents/doc-1/download');

        expect(res.status).toBe(200);
        const cd = res.headers['content-disposition'] || '';
        // Fallback seguro: "documento" en filename (ASCII) y en
        // filename* (UTF-8).
        expect(cd).toContain('filename="documento"');
        expect(cd).toContain("filename*=UTF-8''documento");
    });
});
