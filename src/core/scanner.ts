import { join } from 'path';
import { FolderScanResult } from '../types/index.js';
import { getDirectoryEntries } from '../utils/index.js';

export class Scanner {
  async scanFirstLevelFolders(targetPath: string): Promise<FolderScanResult[]> {
    try {
      const entries = await getDirectoryEntries(targetPath);
      const folders: FolderScanResult[] = [];
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.isSymbolicLink()) {
          folders.push({
            path: join(targetPath, entry.name),
          });
        }
      }
      return folders;
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === 'EACCES' ||
        (error as NodeJS.ErrnoException).code === 'EPERM'
      ) {
        throw new Error(`Permission denied scanning directory: ${targetPath}`);
      }
      throw error;
    }
  }
}
