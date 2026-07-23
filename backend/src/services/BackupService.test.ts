import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BackupService } from './BackupService';

describe('BackupService.pruneBackups', () => {
    let tempDir: string;
    const originalCwd = process.cwd();

    beforeEach(() => {
        // Crear dir temporal bajo la carpeta temporal del OS (no fuga al repo si el cleanup falla)
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rrhh-test-backups-'));
        // Mock process.cwd() sin mutar el cwd real del proceso
        vi.spyOn(process, 'cwd').mockImplementation(() => tempDir);
    });

    afterEach(() => {
        try {
            vi.restoreAllMocks();
            if (tempDir && fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch {
            // Ignore cleanup errors
        }
    });

const createTestFile = (dir: string, name: string, daysOld: number) => {
        const filePath = path.join(dir, name);
        fs.writeFileSync(filePath, 'test content');
        // Mock birthtime by using fs.utimesSync to set atime/mtime (birthtime might be readonly)
        // For our test, we'll sort by mtime as fallback
        const pastTime = new Date();
        pastTime.setDate(pastTime.getDate() - daysOld);
        fs.utimesSync(filePath, pastTime, pastTime);
        return filePath;
    };

    it('should do nothing when files are within limit', () => {
        const dir = path.join(tempDir, 'backups');
        fs.mkdirSync(dir);
        const files = ['backup1.sql', 'backup2.sql', 'backup3.sql'];
        files.forEach(f => createTestFile(dir, f, 1));

        const unlinkSyncSpy = vi.spyOn(fs, 'unlinkSync');
        BackupService.pruneBackups(dir, 5);

        expect(unlinkSyncSpy).not.toHaveBeenCalled();
    });

    it('should delete oldest files when exceeding limit', () => {
        const dir = path.join(tempDir, 'backups');
        fs.mkdirSync(dir);
        // Create 5 files, keep only 3
        const files = [
            createTestFile(dir, 'oldest.sql', 10),
            createTestFile(dir, 'old2.sql', 8),
            createTestFile(dir, 'mid.sql', 5),
            createTestFile(dir, 'new2.sql', 2),
            createTestFile(dir, 'newest.sql', 1)
        ];

        const unlinkSyncSpy = vi.spyOn(fs, 'unlinkSync');
        BackupService.pruneBackups(dir, 3);

        // Should have called unlinkSync for the 2 oldest files
        expect(unlinkSyncSpy).toHaveBeenCalledTimes(2);
        // Check that the correct files were deleted
        const deletedPaths = unlinkSyncSpy.mock.calls.map(call => call[0]);
        expect(deletedPaths).toContain(files[0]);
        expect(deletedPaths).toContain(files[1]);
    });

    it('should handle empty directory gracefully', () => {
        const dir = path.join(tempDir, 'backups');
        fs.mkdirSync(dir);

        expect(() => BackupService.pruneBackups(dir, 3)).not.toThrow();
    });

    it('should handle non-existent directory gracefully', () => {
        const dir = path.join(tempDir, 'nonexistent');
        // The function catches errors, but we want to ensure it doesn't crash
        // However, readdirSync will throw, which is caught by try/catch
        expect(() => BackupService.pruneBackups(dir, 3)).not.toThrow();
    });

    it('should keep exactly maxFiles newest backups', () => {
        const dir = path.join(tempDir, 'backups');
        fs.mkdirSync(dir);
        // Create 10 files with varying ages
        for (let i = 0; i < 10; i++) {
            createTestFile(dir, `backup_${i}.sql`, i);
        }

        const unlinkSyncSpy = vi.spyOn(fs, 'unlinkSync');
        BackupService.pruneBackups(dir, 5);

        // Should have deleted 5 oldest files (indices 9,8,7,6,5) because we created 0 as newest? Let's check logic:
        // Newest are with lower daysOld: backup_0 is 0 days (newest), backup_9 is 9 days (oldest)
        // We keep 5 newest: indices 0-4 (0,1,2,3,4 days old). We delete indices 5-9.
        const deletedFromTestDir = unlinkSyncSpy.mock.calls.filter(([filePath]) => String(filePath).startsWith(dir));
        expect(deletedFromTestDir).toHaveLength(5);
    });
});
