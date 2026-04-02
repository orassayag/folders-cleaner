import { access, readdir, rm, stat, unlink } from 'fs/promises';
import { Dirent } from 'fs';

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export async function getDirectoryEntries(path: string): Promise<Dirent[]> {
  return await readdir(path, { withFileTypes: true });
}

export async function deleteFileOrLink(path: string): Promise<void> {
  await unlink(path);
}

export async function deleteDirectory(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

export function formatPath(path: string): string {
  const maxLength = 60;
  if (path.length <= maxLength) {
    return path;
  }
  return '...' + path.slice(-(maxLength - 3));
}
