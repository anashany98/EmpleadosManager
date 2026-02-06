
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { StorageService } from './StorageService';

const execFileAsync = promisify(execFile);

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const SNAPSHOT_DIR = path.join(BACKUP_DIR, 'snapshots');
const FULL_BACKUP_DIR = path.join(BACKUP_DIR, 'full');

// Ensure directories exist
[BACKUP_DIR, SNAPSHOT_DIR, FULL_BACKUP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

interface BackupResult {
    filePath: string;
    fileName: string;
    size: number;
    type: 'SNAPSHOT' | 'FULL';
    remoteKey?: string;
}

export const BackupService = {
    /**
     * Creates a lightweight backup of just the database
     */
    createSnapshot: async (): Promise<BackupResult> => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `nominas_snapshot_${timestamp}.dump`;
        const destPath = path.join(SNAPSHOT_DIR, fileName);
        const databaseUrl = process.env.DATABASE_URL || '';

        if (databaseUrl.startsWith('postgres')) {
            const url = new URL(databaseUrl);
            const user = url.username;
            const password = url.password;
            const host = url.hostname;
            const port = url.port || '5432';
            const db = url.pathname.replace('/', '');

            await execFileAsync(process.env.PG_DUMP_PATH || 'pg_dump', [
                '-Fc',
                '-h', host,
                '-p', port,
                '-U', user,
                '-f', destPath,
                db
            ], {
                env: { ...process.env, PGPASSWORD: password }
            });

            const stats = fs.statSync(destPath);
            BackupService.pruneBackups(SNAPSHOT_DIR, 24);
            const result: BackupResult = { filePath: destPath, fileName, size: stats.size, type: 'SNAPSHOT' };

            if (process.env.BACKUP_UPLOAD === 'true' && StorageService.provider === 's3') {
                const buffer = fs.readFileSync(destPath);
                const { key } = await StorageService.saveBuffer({
                    folder: 'backups/snapshots',
                    originalName: fileName,
                    buffer,
                    contentType: 'application/octet-stream'
                });
                result.remoteKey = key;
            }

            return result;
        }

        // Fallback: SQLite copy (dev only)
        const sourceDb = path.join(process.cwd(), 'database/prisma/dev.db');

        return new Promise((resolve, reject) => {
            fs.copyFile(sourceDb, destPath, (err) => {
                if (err) return reject(err);
                const stats = fs.statSync(destPath);
                BackupService.pruneBackups(SNAPSHOT_DIR, 24);
                const result: BackupResult = {
                    filePath: destPath,
                    fileName: fileName,
                    size: stats.size,
                    type: 'SNAPSHOT'
                };

                if (process.env.BACKUP_UPLOAD === 'true' && StorageService.provider === 's3') {
                    const buffer = fs.readFileSync(destPath);
                    StorageService.saveBuffer({
                        folder: 'backups/snapshots',
                        originalName: fileName,
                        buffer,
                        contentType: 'application/octet-stream'
                    }).then(({ key }) => {
                        result.remoteKey = key;
                        resolve(result);
                    }).catch(reject);
                    return;
                }

                resolve(result);
            });
        });
    },

    /**
     * Creates a full backup zip including database and uploads
     */
    createFullBackup: async (): Promise<BackupResult> => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `nominas_full_${timestamp}.zip`;
        const destPath = path.join(FULL_BACKUP_DIR, fileName);
        const output = fs.createWriteStream(destPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        const snapshot = await BackupService.createSnapshot();

        return new Promise((resolve, reject) => {
            output.on('close', () => {
                const stats = fs.statSync(destPath);

                // Prune old full backups (keep last 30)
                BackupService.pruneBackups(FULL_BACKUP_DIR, 30);

                const result: BackupResult = {
                    filePath: destPath,
                    fileName: fileName,
                    size: stats.size,
                    type: 'FULL'
                };

                if (process.env.BACKUP_UPLOAD === 'true' && StorageService.provider === 's3') {
                    const buffer = fs.readFileSync(destPath);
                    StorageService.saveBuffer({
                        folder: 'backups/full',
                        originalName: fileName,
                        buffer,
                        contentType: 'application/zip'
                    }).then(({ key }) => {
                        result.remoteKey = key;
                        resolve(result);
                    }).catch(reject);
                    return;
                }

                resolve(result);
            });

            archive.on('error', (err: any) => reject(err));

            archive.pipe(output);

            // Add Database dump
            archive.file(snapshot.filePath, { name: snapshot.fileName });

            archive.finalize();
        });
    },

    /**
     * Lists available backups
     */
    getBackups: async () => {
        const getFiles = (dir: string, type: 'SNAPSHOT' | 'FULL') => {
            if (!fs.existsSync(dir)) return [];
            return fs.readdirSync(dir)
                .map(file => {
                    const stats = fs.statSync(path.join(dir, file));
                    return {
                        name: file,
                        path: path.join(dir, file),
                        size: stats.size,
                        createdAt: stats.birthtime,
                        type
                    };
                })
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        };

        return {
            snapshots: getFiles(SNAPSHOT_DIR, 'SNAPSHOT'),
            full: getFiles(FULL_BACKUP_DIR, 'FULL')
        };
    },

    /**
     * Deletes old backups to save space
     */
    pruneBackups: (dir: string, maxFiles: number) => {
        try {
            const files = fs.readdirSync(dir)
                .map(file => ({
                    name: file,
                    path: path.join(dir, file),
                    time: fs.statSync(path.join(dir, file)).birthtime.getTime()
                }))
                .sort((a, b) => b.time - a.time); // Newest first

            // Remove files that exceed the limit
            if (files.length > maxFiles) {
                files.slice(maxFiles).forEach(file => {
                    fs.unlinkSync(file.path);
                    console.log(`[Backup] Pruned old backup: ${file.name}`);
                });
            }
        } catch (error) {
            console.error('[Backup] Error pruning backups:', error);
        }
    }
};
