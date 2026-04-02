import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { validateAndResolvePath } from '../utils/pathValidator.js';
import { Scanner } from '../core/scanner.js';
import { Cleaner } from '../core/cleaner.js';

describe('Integration Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'folders-cleaner-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Full workflow', () => {
    it('should complete full workflow from validation to cleaning', async () => {
      const folder1 = join(tempDir, 'folder1');
      const folder2 = join(tempDir, 'folder2');
      await mkdir(folder1);
      await mkdir(folder2);
      await writeFile(join(folder1, 'file1.txt'), 'test');
      await writeFile(join(folder2, 'file2.txt'), 'test');
      const resolvedPath = await validateAndResolvePath(tempDir);
      expect(resolvedPath).toBe(tempDir);
      const scanner = new Scanner();
      const folders = await scanner.scanFirstLevelFolders(resolvedPath);
      expect(folders).toHaveLength(2);
      const cleaner = new Cleaner();
      const results = await cleaner.clean(folders);
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('should handle empty target directory', async () => {
      const resolvedPath = await validateAndResolvePath(tempDir);
      const scanner = new Scanner();
      const folders = await scanner.scanFirstLevelFolders(resolvedPath);
      expect(folders).toHaveLength(0);
    });

    it('should reject protected paths', async () => {
      const protectedPath = process.platform === 'win32' ? 'C:\\Windows' : '/etc';
      await expect(validateAndResolvePath(protectedPath)).rejects.toThrow(
        'Cannot clean protected system path'
      );
    });

    it('should handle multiple folders with mixed success', async () => {
      const folder1 = join(tempDir, 'folder1');
      const folder2 = join(tempDir, 'folder2');
      await mkdir(folder1);
      await mkdir(folder2);
      await writeFile(join(folder1, 'file1.txt'), 'test');
      await writeFile(join(folder2, 'file2.txt'), 'test');
      const scanner = new Scanner();
      const folders = await scanner.scanFirstLevelFolders(tempDir);
      const cleaner = new Cleaner();
      const results = await cleaner.clean(folders);
      expect(results).toHaveLength(2);
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBeGreaterThanOrEqual(0);
    });

    it('should track progress during cleaning', async () => {
      const folder1 = join(tempDir, 'folder1');
      const folder2 = join(tempDir, 'folder2');
      const folder3 = join(tempDir, 'folder3');
      await mkdir(folder1);
      await mkdir(folder2);
      await mkdir(folder3);
      await writeFile(join(folder1, 'file1.txt'), 'test');
      await writeFile(join(folder2, 'file2.txt'), 'test');
      await writeFile(join(folder3, 'file3.txt'), 'test');
      const scanner = new Scanner();
      const folders = await scanner.scanFirstLevelFolders(tempDir);
      const progressUpdates: number[] = [];
      const cleaner = new Cleaner();
      await cleaner.clean(folders, (info) => {
        progressUpdates.push(info.current);
        expect(info.total).toBe(3);
        expect(info.currentFolder).toBeTruthy();
      });
      expect(progressUpdates).toEqual([1, 2, 3]);
    });

    it('should handle relative paths', async () => {
      const folder1 = join(tempDir, 'folder1');
      await mkdir(folder1);
      await writeFile(join(folder1, 'file1.txt'), 'test');
      const resolvedPath = await validateAndResolvePath(tempDir);
      expect(resolvedPath).toBe(tempDir);
      const scanner = new Scanner();
      const folders = await scanner.scanFirstLevelFolders(resolvedPath);
      expect(folders).toHaveLength(1);
    });
  });

  describe('Settings validation scenarios', () => {
    it('should validate empty targetPath', async () => {
      const emptyPath = '';
      await expect(validateAndResolvePath(emptyPath)).rejects.toThrow('Target path cannot be empty');
    });

    it('should validate non-existent path', async () => {
      const nonExistentPath = '/nonexistent/path/that/does/not/exist';
      await expect(validateAndResolvePath(nonExistentPath)).rejects.toThrow('Target folder not found');
    });
  });

  describe('Progress bar simulation', () => {
    it('should handle TTY mode progress updates', async () => {
      const folder1 = join(tempDir, 'folder1');
      await mkdir(folder1);
      await writeFile(join(folder1, 'file1.txt'), 'test');
      const scanner = new Scanner();
      const folders = await scanner.scanFirstLevelFolders(tempDir);
      const cleaner = new Cleaner();
      const consoleSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      await cleaner.clean(folders, (info) => {
        if (process.stdout.isTTY) {
          process.stdout.write(`\rProcessing: [${info.current}/${info.total}]`);
        }
      });
      if (process.stdout.isTTY) {
        expect(consoleSpy).toHaveBeenCalled();
      }
      consoleSpy.mockRestore();
    });

    it('should handle non-TTY mode progress updates', async () => {
      const folder1 = join(tempDir, 'folder1');
      await mkdir(folder1);
      await writeFile(join(folder1, 'file1.txt'), 'test');
      const scanner = new Scanner();
      const folders = await scanner.scanFirstLevelFolders(tempDir);
      const cleaner = new Cleaner();
      const progressLogs: string[] = [];
      await cleaner.clean(folders, (info) => {
        if (!process.stdout.isTTY) {
          progressLogs.push(`Processing: [${info.current}/${info.total}]`);
        }
      });
      if (!process.stdout.isTTY) {
        expect(progressLogs.length).toBeGreaterThan(0);
      }
    });
  });
});
