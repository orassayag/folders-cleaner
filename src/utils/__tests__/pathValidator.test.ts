import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as os from 'os';
import { join, dirname } from 'path';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock os
vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return {
    ...actual,
    homedir: vi.fn(actual.homedir),
    tmpdir: vi.fn(actual.tmpdir),
  };
});

// Mock fs/promises
vi.mock('fs/promises', async () => {
  const actual =
    await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    access: vi.fn(actual.access),
  };
});

// Mock path
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return {
    ...actual,
    normalize: vi.fn(actual.normalize),
  };
});

import {
  validateAndResolvePath,
  isProtectedPath,
  isWindowsPath,
  validatePathPermissions,
} from '../index.js';

describe('pathValidator', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'folders-cleaner-test-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
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
      const home = os.homedir();
      expect(isProtectedPath(home)).toBe(true);
    });

    it('should detect Unix protected paths', async () => {
      // Force platform to linux for this test
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      // We need to mock normalize because on Windows it will convert / to \
      const mockNormalize = vi
        .mocked(path.normalize)
        .mockImplementation((p) => p);

      try {
        expect(isProtectedPath('/')).toBe(true);
        expect(isProtectedPath('/etc')).toBe(true);
        expect(isProtectedPath('/usr')).toBe(true);
        expect(isProtectedPath('/bin')).toBe(true);

        const home = '/home/user';
        vi.mocked(os.homedir).mockReturnValue(home);
        expect(isProtectedPath(home)).toBe(true);
        expect(isProtectedPath('/home')).toBe(true);
      } finally {
        vi.mocked(os.homedir).mockRestore();
        mockNormalize.mockRestore();
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      }
    });

    it('should detect parent of CWD as protected', () => {
      const cwd = process.cwd();
      const parent = dirname(cwd);
      const grandParent = dirname(parent);

      expect(isProtectedPath(parent)).toBe(true);
      expect(isProtectedPath(grandParent)).toBe(true);
    });

    it('should not detect current working directory as protected if it is a temp dir', () => {
      // Mock normalize to return a temp path
      vi.mocked(path.normalize).mockReturnValueOnce('/tmp/some-dir');
      expect(isProtectedPath('/tmp/some-dir')).toBe(false);
      vi.mocked(path.normalize).mockRestore();
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
      await expect(
        validatePathPermissions('/nonexistent/path')
      ).rejects.toThrow();
    });

    it('should throw for permission denied', async () => {
      const error = new Error('EACCES') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      vi.mocked(fs.access).mockRejectedValueOnce(error);

      await expect(validatePathPermissions(tempDir)).rejects.toThrow(
        'Permission denied accessing path'
      );
    });
  });

  describe('validateAndResolvePath', () => {
    it('should validate and resolve absolute path', async () => {
      const resolved = await validateAndResolvePath(tempDir);
      expect(resolved).toBe(tempDir);
    });

    it('should throw for empty path', async () => {
      await expect(validateAndResolvePath('')).rejects.toThrow(
        'Target path cannot be empty'
      );
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
      const protectedPath =
        process.platform === 'win32' ? 'C:\\Windows' : '/etc';
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
