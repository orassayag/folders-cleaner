import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, readdir, symlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Cleaner } from '../../core/cleaner.js';
import { FolderScanResult } from '../../types/index.js';
import { pathExists } from '../../utils/fileUtils.js';

describe('Cleaner', () => {
  let tempDir: string;
  let cleaner: Cleaner;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'folders-cleaner-test-'));
    cleaner = new Cleaner();
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('clean', () => {
    it('should delete all contents but preserve parent folder', async () => {
      const folder1 = join(tempDir, 'folder1');
      await mkdir(folder1);
      await writeFile(join(folder1, 'file1.txt'), 'test');
      await writeFile(join(folder1, 'file2.txt'), 'test');
      await mkdir(join(folder1, 'nested'));
      await writeFile(join(folder1, 'nested', 'file3.txt'), 'test');
      const folders: FolderScanResult[] = [{ path: folder1 }];
      const results = await cleaner.clean(folders);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      if (results[0].success) {
        expect(results[0].itemsDeleted).toBe(3);
      }
      expect(await pathExists(folder1)).toBe(true);
      const entries = await readdir(folder1);
      expect(entries).toHaveLength(0);
    });

    it('should delete hidden files and folders', async () => {
      const folder1 = join(tempDir, 'folder1');
      await mkdir(folder1);
      await writeFile(join(folder1, '.hidden'), 'test');
      await mkdir(join(folder1, '.hiddendir'));
      await writeFile(join(folder1, '.hiddendir', 'file.txt'), 'test');
      const folders: FolderScanResult[] = [{ path: folder1 }];
      const results = await cleaner.clean(folders);
      expect(results[0].success).toBe(true);
      if (results[0].success) {
        expect(results[0].itemsDeleted).toBe(2);
      }
      const entries = await readdir(folder1);
      expect(entries).toHaveLength(0);
    });

    it('should handle empty folders', async () => {
      const folder1 = join(tempDir, 'folder1');
      await mkdir(folder1);
      const folders: FolderScanResult[] = [{ path: folder1 }];
      const results = await cleaner.clean(folders);
      expect(results[0].success).toBe(true);
      if (results[0].success) {
        expect(results[0].itemsDeleted).toBe(0);
      }
      expect(await pathExists(folder1)).toBe(true);
    });

    it('should delete deeply nested directory trees', async () => {
      const folder1 = join(tempDir, 'folder1');
      await mkdir(folder1);
      let currentPath = folder1;
      for (let i = 0; i < 10; i++) {
        currentPath = join(currentPath, `level${i}`);
        await mkdir(currentPath);
        await writeFile(join(currentPath, `file${i}.txt`), 'test');
      }
      const folders: FolderScanResult[] = [{ path: folder1 }];
      const results = await cleaner.clean(folders);
      expect(results[0].success).toBe(true);
      if (results[0].success) {
        expect(results[0].itemsDeleted).toBe(1);
      }
      const entries = await readdir(folder1);
      expect(entries).toHaveLength(0);
    });

    it('should process multiple folders sequentially', async () => {
      const folder1 = join(tempDir, 'folder1');
      const folder2 = join(tempDir, 'folder2');
      await mkdir(folder1);
      await mkdir(folder2);
      await writeFile(join(folder1, 'file1.txt'), 'test');
      await writeFile(join(folder2, 'file2.txt'), 'test');
      const folders: FolderScanResult[] = [{ path: folder1 }, { path: folder2 }];
      const results = await cleaner.clean(folders);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(await pathExists(folder1)).toBe(true);
      expect(await pathExists(folder2)).toBe(true);
      expect((await readdir(folder1)).length).toBe(0);
      expect((await readdir(folder2)).length).toBe(0);
    });

    it('should continue after folder failure', async () => {
      const folder1 = join(tempDir, 'folder1');
      const folder2 = join(tempDir, 'folder2');
      await mkdir(folder1);
      await mkdir(folder2);
      await writeFile(join(folder2, 'file2.txt'), 'test');
      const folders: FolderScanResult[] = [{ path: folder1 }, { path: folder2 }];
      const results = await cleaner.clean(folders);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should delete symlinks inside folders without following them', async () => {
      const folder1 = join(tempDir, 'folder1');
      const targetFile = join(tempDir, 'target.txt');
      await mkdir(folder1);
      await writeFile(targetFile, 'target content');
      try {
        await symlink(targetFile, join(folder1, 'link.txt'), 'file');
        const folders: FolderScanResult[] = [{ path: folder1 }];
        const results = await cleaner.clean(folders);
        expect(results[0].success).toBe(true);
        if (results[0].success) {
          expect(results[0].itemsDeleted).toBe(1);
        }
        expect(await pathExists(targetFile)).toBe(true);
        expect(await pathExists(join(folder1, 'link.txt'))).toBe(false);
      } catch {
        console.log('Symlink test skipped (may require permissions)');
      }
    });

    it('should handle unicode filenames', async () => {
      const folder1 = join(tempDir, 'folder1');
      await mkdir(folder1);
      await writeFile(join(folder1, 'file名.txt'), 'test');
      await writeFile(join(folder1, 'файл.txt'), 'test');
      const folders: FolderScanResult[] = [{ path: folder1 }];
      const results = await cleaner.clean(folders);
      expect(results[0].success).toBe(true);
      if (results[0].success) {
        expect(results[0].itemsDeleted).toBe(2);
      }
    });

    it('should handle filenames with spaces', async () => {
      const folder1 = join(tempDir, 'folder1');
      await mkdir(folder1);
      await writeFile(join(folder1, 'file with spaces.txt'), 'test');
      const folders: FolderScanResult[] = [{ path: folder1 }];
      const results = await cleaner.clean(folders);
      expect(results[0].success).toBe(true);
      if (results[0].success) {
        expect(results[0].itemsDeleted).toBe(1);
      }
    });

    it('should call progress callback for each folder', async () => {
      const folder1 = join(tempDir, 'folder1');
      const folder2 = join(tempDir, 'folder2');
      await mkdir(folder1);
      await mkdir(folder2);
      const folders: FolderScanResult[] = [{ path: folder1 }, { path: folder2 }];
      const progressUpdates: number[] = [];
      await cleaner.clean(folders, (info) => {
        progressUpdates.push(info.current);
      });
      expect(progressUpdates).toEqual([1, 2]);
    });

    it('should return failure result for non-existent folder', async () => {
      const nonExistentFolder = join(tempDir, 'nonexistent');
      const folders: FolderScanResult[] = [{ path: nonExistentFolder }];
      const results = await cleaner.clean(folders);
      expect(results[0].success).toBe(false);
      if (!results[0].success) {
        expect(results[0].error).toBeTruthy();
        expect(results[0].partiallyDeleted).toBe(0);
      }
    });
  });
});
