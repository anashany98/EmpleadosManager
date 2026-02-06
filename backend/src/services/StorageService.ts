import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type StorageProvider = 's3' | 'local';

const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || 's3') as StorageProvider;

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'uploads');

const s3Client = (() => {
    if (STORAGE_PROVIDER !== 's3') return null;
    const region = process.env.S3_REGION || 'us-east-1';
    const endpoint = process.env.S3_ENDPOINT || undefined;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey || !process.env.S3_BUCKET) {
        throw new Error('FATAL: Missing S3 configuration (S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET).');
    }
    return new S3Client({
        region,
        endpoint,
        forcePathStyle: !!endpoint,
        credentials: { accessKeyId, secretAccessKey }
    });
})();

const cleanFilename = (name: string) =>
    name.replace(/[^a-z0-9.\-_]/gi, '_').toLowerCase();

const makeKey = (folder: string, originalName: string) => {
    const safeFolder = folder.replace(/\\/g, '/').replace(/\.\./g, '').replace(/^\/+|\/+$/g, '');
    const cleanName = cleanFilename(originalName);
    const unique = `${Date.now()}-${crypto.randomInt(1e9)}`;
    return `${safeFolder}/${unique}-${cleanName}`.replace(/\/+/g, '/');
};

export const StorageService = {
    provider: STORAGE_PROVIDER,

    async saveBuffer(params: { folder: string; originalName: string; buffer: Buffer; contentType?: string }) {
        const key = makeKey(params.folder, params.originalName);

        if (STORAGE_PROVIDER === 'local') {
            const filePath = path.join(LOCAL_UPLOAD_DIR, key);
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, params.buffer);
            return { key };
        }

        if (!s3Client) throw new Error('S3 client not initialized');
        const bucket = process.env.S3_BUCKET!;
        await s3Client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: params.buffer,
            ContentType: params.contentType
        }));
        return { key };
    },

    async deleteFile(key: string) {
        if (!key) return;
        if (STORAGE_PROVIDER === 'local') {
            const filePath = path.join(LOCAL_UPLOAD_DIR, key);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return;
        }
        if (!s3Client) throw new Error('S3 client not initialized');
        const bucket = process.env.S3_BUCKET!;
        await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },

    async getBuffer(key: string): Promise<Buffer> {
        if (STORAGE_PROVIDER === 'local') {
            const filePath = path.join(LOCAL_UPLOAD_DIR, key);
            return fs.promises.readFile(filePath);
        }
        if (!s3Client) throw new Error('S3 client not initialized');
        const bucket = process.env.S3_BUCKET!;
        const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const body = response.Body;
        if (!body) throw new Error('S3 object body is empty');
        // Body is a stream in Node
        const chunks: Buffer[] = [];
        for await (const chunk of body as any) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    },

    async getSignedDownloadUrl(key: string, expiresInSeconds = 300) {
        if (STORAGE_PROVIDER === 'local') return null;
        if (!s3Client) throw new Error('S3 client not initialized');
        const bucket = process.env.S3_BUCKET!;
        return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: expiresInSeconds });
    }
};
