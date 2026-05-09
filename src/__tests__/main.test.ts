import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { main } from '../main.js';
import { settings } from '../settings.js';
import * as pathValidator from '../utils/pathValidator.js';
import { Scanner } from '../core/scanner.js';
import { Cleaner } from '../core/cleaner.js';

vi.mock('../settings.js', () => ({
  settings: {
    targetPath: '/test/path',
  },
}));

vi.mock('../utils/pathValidator.js', () => ({
  validateAndResolvePath: vi.fn(),
}));

const scanFirstLevelFoldersMock = vi.fn();
const cleanMock = vi.fn();

vi.mock('../core/scanner.js', () => {
  return {
    Scanner: vi.fn().mockImplementation(function () {
      return {
        scanFirstLevelFolders: scanFirstLevelFoldersMock,
      };
    }),
  };
});

vi.mock('../core/cleaner.js', () => {
  return {
    Cleaner: vi.fn().mockImplementation(function () {
      return {
        clean: cleanMock,
      };
    }),
  };
});

describe('main', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let processStdoutWriteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });
    processStdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // Reset mocks
    vi.mocked(pathValidator.validateAndResolvePath).mockReset();
    scanFirstLevelFoldersMock.mockReset();
    cleanMock.mockReset();
    vi.mocked(Scanner).mockClear();
    vi.mocked(Cleaner).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should run successfully when folders are found and cleaned', async () => {
    vi.mocked(pathValidator.validateAndResolvePath).mockResolvedValue('/test/path');
    scanFirstLevelFoldersMock.mockResolvedValue([{ path: '/test/path/folder1' }]);
    cleanMock.mockResolvedValue([
      { success: true, itemsDeleted: 5, folderPath: '/test/path/folder1' },
    ]);

    await main();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Successfully cleaned 1/1 folders')
    );
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('should exit with 0 when no folders are found', async () => {
    vi.mocked(pathValidator.validateAndResolvePath).mockResolvedValue('/test/path');
    scanFirstLevelFoldersMock.mockResolvedValue([]);

    await main();

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No subdirectories found'));
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('should show error and exit with 1 when settings are invalid (empty)', async () => {
    settings.targetPath = '';
    await main();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration Required'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
    settings.targetPath = '/test/path'; // reset
  });

  it('should show error and exit with 1 when settings are placeholder', async () => {
    settings.targetPath = '/path/to/target';
    await main();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration Required'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
    settings.targetPath = '/test/path'; // reset
  });

  it('should handle partial failures', async () => {
    vi.mocked(pathValidator.validateAndResolvePath).mockResolvedValue('/test/path');
    scanFirstLevelFoldersMock.mockResolvedValue([
      { path: '/test/path/folder1' },
      { path: '/test/path/folder2' },
    ]);
    cleanMock.mockResolvedValue([
      { success: true, itemsDeleted: 5, folderPath: '/test/path/folder1' },
      { success: false, error: 'Locked', partiallyDeleted: 2, folderPath: '/test/path/folder2' },
    ]);

    await main();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cleaned 1/2 folders (1 failed)')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle "Target folder not found" error', async () => {
    vi.mocked(pathValidator.validateAndResolvePath).mockRejectedValue(
      new Error('Target folder not found')
    );
    await main();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Target folder not found')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle "Target must be a folder" error', async () => {
    vi.mocked(pathValidator.validateAndResolvePath).mockRejectedValue(
      new Error('Target must be a folder')
    );
    await main();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Target must be a folder')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle "Cannot clean protected system path" error', async () => {
    vi.mocked(pathValidator.validateAndResolvePath).mockRejectedValue(
      new Error('Cannot clean protected system path')
    );
    await main();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot clean protected system path')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle "Permission denied" error', async () => {
    vi.mocked(pathValidator.validateAndResolvePath).mockRejectedValue(
      new Error('Permission denied')
    );
    await main();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Permission denied'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle generic errors', async () => {
    vi.mocked(pathValidator.validateAndResolvePath).mockRejectedValue(
      new Error('Some random error')
    );
    await main();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Fatal Error'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should display progress', async () => {
    vi.mocked(pathValidator.validateAndResolvePath).mockResolvedValue('/test/path');
    scanFirstLevelFoldersMock.mockResolvedValue([{ path: '/test/path/folder1' }]);
    cleanMock.mockImplementation(async (_folders, progressCb) => {
      progressCb({ current: 1, total: 1, currentFolder: '/test/path/folder1' });
      return [{ success: true, itemsDeleted: 5, folderPath: '/test/path/folder1' }];
    });

    // Mock TTY
    const originalIsTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

    await main();

    expect(processStdoutWriteSpy).toHaveBeenCalled();

    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    await main();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Processing:'));

    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
  });
});
