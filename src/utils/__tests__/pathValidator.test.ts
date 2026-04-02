import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir, homedir } from 'os';
import { join } from 'path';
import {
  validateAndResolvePath,
  isProtectedPath,
  isWindowsPath,
  validatePathPermissions,
} from '../pathValidator.js';

describe('pathValidator', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'folders-cleaner-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('isWindowsPath', () => {
    it('should detect Windows drive letter paths', () => {
      expect(isWindowsPath('C:\\Users\\test')).toBe(true);
      expect(isWindowsPath('D:/Users/test')).toBe(true);
      expect(isWindowsPath('c:\\path')).toBe(true);
    });

    it('should detect Windows UNC paths', () => {
      expect(isWindowsPath('\\\\server\\share')).toBe(true);
      expect(isWindowsPath('//server/share')).toBe(true);
    });

    it('should not detect Unix paths as Windows paths', () => {
      expect(isWindowsPath('/Users/test')).toBe(false);
      expect(isWindowsPath('/etc')).toBe(false);
      expect(isWindowsPath('./relative')).toBe(false);
    });
  });

  describe('isProtectedPath', () => {
    it('should detect root directory as protected', () => {
      if (process.platform === 'win32') {
        expect(isProtectedPath('C:\\')).toBe(true);
        expect(isProtectedPath('D:\\')).toBe(true);
      } else {
        expect(isProtectedPath('/')).toBe(true);
      }
    });

    it('should detect system directories as protected', () => {
      if (process.platform === 'win32') {
        expect(isProtectedPath('C:\\Windows')).toBe(true);
        expect(isProtectedPath('C:\\Program Files')).toBe(true);
      } else {
        expect(isProtectedPath('/etc')).toBe(true);
        expect(isProtectedPath('/usr')).toBe(true);
        expect(isProtectedPath('/bin')).toBe(true);
      }
    });

    it('should detect home directory as protected', () => {
      const home = homedir();
      expect(isProtectedPath(home)).toBe(true);
    });

    it('should detect current working directory as protected', () => {
      const cwd = process.cwd();
      expect(isProtectedPath(cwd)).toBe(true);
    });

    it('should not detect regular directories as protected', () => {
      expect(isProtectedPath(tempDir)).toBe(false);
    });
  });

  describe('validatePathPermissions', () => {
    it('should pass for accessible directory', async () => {
      await expect(validatePathPermissions(tempDir)).resolves.toBeUndefined();
    });

    it('should throw for non-existent directory', async () => {
      await expect(validatePathPermissions('/nonexistent/path')).rejects.toThrow();
    });
  });

  describe('validateAndResolvePath', () => {
    it('should validate and resolve absolute path', async () => {
      const resolved = await validateAndResolvePath(tempDir);
      expect(resolved).toBe(tempDir);
    });

    it('should throw for empty path', async () => {
      await expect(validateAndResolvePath('')).rejects.toThrow('Target path cannot be empty');
    });

    it('should throw for non-existent path', async () => {
      await expect(validateAndResolvePath('/nonexistent/path')).rejects.toThrow(
        'Target folder not found'
      );
    });

    it('should throw for file instead of directory', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'test');
      await expect(validateAndResolvePath(filePath)).rejects.toThrow(
        'Target must be a folder, not a file'
      );
    });

    it('should throw for protected system path', async () => {
      const protectedPath = process.platform === 'win32' ? 'C:\\Windows' : '/etc';
      await expect(validateAndResolvePath(protectedPath)).rejects.toThrow(
        'Cannot clean protected system path'
      );
    });

    it('should resolve relative paths', async () => {
      const resolved = await validateAndResolvePath(tempDir);
      expect(resolved).toBe(tempDir);
    });
  });
});
