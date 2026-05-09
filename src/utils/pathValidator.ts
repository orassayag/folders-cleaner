import { access, constants, stat } from 'fs/promises';
import { homedir } from 'os';
import { resolve, normalize, dirname } from 'path';

export function isWindowsPath(pathStr: string): boolean {
  const drivePattern = /^[a-zA-Z]:[/\\]/;
  const uncPattern = /^[/\\]{2}/;
  return drivePattern.test(pathStr) || uncPattern.test(pathStr);
}

export function isProtectedPath(resolvedPath: string): boolean {
  const normalizedPath = normalize(resolvedPath);
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    const windowsProtectedPaths = [
      /^[a-zA-Z]:[/\\]$/i,
      /^[a-zA-Z]:[/\\]Windows/i,
      /^[a-zA-Z]:[/\\]Program Files/i,
      /^[a-zA-Z]:[/\\]Program Files \(x86\)/i,
      /^[a-zA-Z]:[/\\]ProgramData/i,
      /^[a-zA-Z]:[/\\]Windows[/\\]System32/i,
    ];
    for (const pattern of windowsProtectedPaths) {
      if (pattern.test(normalizedPath)) {
        return true;
      }
    }
    const homeDir = normalize(homedir());
    const usersDir = dirname(homeDir);
    if (
      normalizedPath.toLowerCase() === homeDir.toLowerCase() ||
      normalizedPath.toLowerCase() === usersDir.toLowerCase()
    ) {
      return true;
    }
  } else {
    const unixProtectedPaths = [
      '/',
      '/etc',
      '/usr',
      '/bin',
      '/sbin',
      '/System',
      '/Library',
      '/Applications',
    ];
    if (unixProtectedPaths.includes(normalizedPath)) {
      return true;
    }
    const homeDir = normalize(homedir());
    const parentOfHome = dirname(homeDir);
    if (normalizedPath === homeDir || normalizedPath === parentOfHome) {
      return true;
    }
  }
  const cwd = normalize(process.cwd());
  const isTempDir =
    normalizedPath.startsWith('/tmp') ||
    normalizedPath.startsWith('/var/folders') ||
    normalizedPath.startsWith('/private/var/folders');
  /* istanbul ignore next */
  if (!isTempDir && normalizedPath === cwd) {
    return true;
  }
  if (!isTempDir) {
    let currentDir = cwd;
    for (let i = 0; i < 2; i++) {
      const parentDir = dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      if (normalizedPath === parentDir) {
        return true;
      }
      currentDir = parentDir;
    }
  }
  return false;
}

export async function validatePathPermissions(resolvedPath: string): Promise<void> {
  try {
    await access(resolvedPath, constants.R_OK | constants.W_OK);
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === 'EACCES' ||
      (error as NodeJS.ErrnoException).code === 'EPERM'
    ) {
      throw new Error(`Permission denied accessing path: ${resolvedPath}`);
    }
    throw error;
  }
}

export async function validateAndResolvePath(targetPath: string): Promise<string> {
  if (!targetPath || targetPath.trim() === '') {
    throw new Error('Target path cannot be empty');
  }
  const resolvedPath = resolve(targetPath);
  if (isProtectedPath(resolvedPath)) {
    throw new Error(`Cannot clean protected system path: ${resolvedPath}`);
  }
  try {
    const stats = await stat(resolvedPath);
    if (!stats.isDirectory()) {
      throw new Error(`Target must be a folder, not a file: ${resolvedPath}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Target folder not found: ${resolvedPath}`);
    }
    throw error;
  }
  await validatePathPermissions(resolvedPath);
  return resolvedPath;
}
