import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  pathExists,
  isDirectory,
  getDirectoryEntries,
  deleteFileOrLink,
  deleteDirectory,
  formatPath,
} from '../fileUtils.js';

describe('fileUtils', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'folders-cleaner-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('pathExists', () => {
    it('should return true for existing path', async () => {
      expect(await pathExists(tempDir)).toBe(true);
    });

    it('should return false for non-existing path', async () => {
      expect(await pathExists('/nonexistent/path')).toBe(false);
    });
  });

  describe('isDirectory', () => {
    it('should return true for directory', async () => {
      expect(await isDirectory(tempDir)).toBe(true);
    });

    it('should return false for file', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'test');
      expect(await isDirectory(filePath)).toBe(false);
    });

    it('should return false for non-existing path', async () => {
      expect(await isDirectory('/nonexistent/path')).toBe(false);
    });
  });

  describe('getDirectoryEntries', () => {
    it('should return directory entries', async () => {
      await mkdir(join(tempDir, 'subdir'));
      await writeFile(join(tempDir, 'file.txt'), 'test');
      const entries = await getDirectoryEntries(tempDir);
      expect(entries).toHaveLength(2);
      expect(entries.some((e) => e.name === 'subdir' && e.isDirectory())).toBe(true);
      expect(entries.some((e) => e.name === 'file.txt' && e.isFile())).toBe(true);
    });

    it('should return empty array for empty directory', async () => {
      const entries = await getDirectoryEntries(tempDir);
      expect(entries).toHaveLength(0);
    });
  });

  describe('deleteFileOrLink', () => {
    it('should delete file', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'test');
      expect(await pathExists(filePath)).toBe(true);
      await deleteFileOrLink(filePath);
      expect(await pathExists(filePath)).toBe(false);
    });
  });

  describe('deleteDirectory', () => {
    it('should delete empty directory', async () => {
      const dirPath = join(tempDir, 'subdir');
      await mkdir(dirPath);
      expect(await pathExists(dirPath)).toBe(true);
      await deleteDirectory(dirPath);
      expect(await pathExists(dirPath)).toBe(false);
    });

    it('should delete directory with contents', async () => {
      const dirPath = join(tempDir, 'subdir');
      await mkdir(dirPath);
      await writeFile(join(dirPath, 'file.txt'), 'test');
      await mkdir(join(dirPath, 'nested'));
      expect(await pathExists(dirPath)).toBe(true);
      await deleteDirectory(dirPath);
      expect(await pathExists(dirPath)).toBe(false);
    });
  });

  describe('formatPath', () => {
    it('should return short paths unchanged', () => {
      const shortPath = '/short/path';
      expect(formatPath(shortPath)).toBe(shortPath);
    });

    it('should truncate long paths', () => {
      const longPath = '/very/long/path/that/exceeds/sixty/characters/and/should/be/truncated';
      const formatted = formatPath(longPath);
      expect(formatted.startsWith('...')).toBe(true);
      expect(formatted.length).toBeLessThanOrEqual(60);
    });
  });
});
