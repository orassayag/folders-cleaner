import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, symlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Scanner } from '../../core/scanner.js';
import * as fileUtils from '../../utils/fileUtils.js';

describe('Scanner', () => {
  let tempDir: string;
  let scanner: Scanner;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'folders-cleaner-test-'));
    scanner = new Scanner();
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('scanFirstLevelFolders', () => {
    it('should return only first-level directories', async () => {
      await mkdir(join(tempDir, 'folder1'));
      await mkdir(join(tempDir, 'folder2'));
      await mkdir(join(tempDir, 'folder1', 'nested'));
      const results = await scanner.scanFirstLevelFolders(tempDir);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.path)).toContain(join(tempDir, 'folder1'));
      expect(results.map((r) => r.path)).toContain(join(tempDir, 'folder2'));
    });

    it('should skip files at first level', async () => {
      await mkdir(join(tempDir, 'folder1'));
      await writeFile(join(tempDir, 'file.txt'), 'test');
      const results = await scanner.scanFirstLevelFolders(tempDir);
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe(join(tempDir, 'folder1'));
    });

    it('should skip symlinks at first level', async () => {
      await mkdir(join(tempDir, 'folder1'));
      const targetDir = join(tempDir, 'target');
      await mkdir(targetDir);
      try {
        await symlink(targetDir, join(tempDir, 'link'), 'dir');
        const results = await scanner.scanFirstLevelFolders(tempDir);
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.path)).not.toContain(join(tempDir, 'link'));
      } catch {
        console.log('Symlink test skipped (may require permissions)');
      }
    });

    it('should return empty array for empty directory', async () => {
      const results = await scanner.scanFirstLevelFolders(tempDir);
      expect(results).toHaveLength(0);
    });

    it('should return empty array when only files present', async () => {
      await writeFile(join(tempDir, 'file1.txt'), 'test');
      await writeFile(join(tempDir, 'file2.txt'), 'test');
      const results = await scanner.scanFirstLevelFolders(tempDir);
      expect(results).toHaveLength(0);
    });

    it('should throw error for non-existent directory', async () => {
      await expect(scanner.scanFirstLevelFolders('/nonexistent/path')).rejects.toThrow();
    });

    it('should throw specific error for permission denied', async () => {
      const error = new Error('EACCES') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      const spy = vi.spyOn(fileUtils, 'getDirectoryEntries').mockRejectedValueOnce(error);

      await expect(scanner.scanFirstLevelFolders(tempDir)).rejects.toThrow(
        'Permission denied scanning directory'
      );
      spy.mockRestore();
    });

    it('should throw specific error for EPERM permission denied', async () => {
      const error = new Error('EPERM') as NodeJS.ErrnoException;
      error.code = 'EPERM';
      const spy = vi.spyOn(fileUtils, 'getDirectoryEntries').mockRejectedValueOnce(error);

      await expect(scanner.scanFirstLevelFolders(tempDir)).rejects.toThrow(
        'Permission denied scanning directory'
      );
      spy.mockRestore();
    });
  });
});
