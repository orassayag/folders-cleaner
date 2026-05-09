import { join } from 'path';
import { CleanResult, FolderScanResult, ProgressInfo } from '../types/index.js';
import { deleteDirectory, deleteFileOrLink, getDirectoryEntries } from '../utils/fileUtils.js';
import { rm } from 'fs/promises';

export type ProgressCallback = (info: ProgressInfo) => void;

export class Cleaner {
  async clean(folders: FolderScanResult[], onProgress?: ProgressCallback): Promise<CleanResult[]> {
    const results: CleanResult[] = [];
    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: folders.length,
          currentFolder: folder.path,
        });
      }
      const result = await this.cleanFolder(folder.path);
      results.push(result);
    }
    return results;
  }

  private async cleanFolder(folderPath: string): Promise<CleanResult> {
    let itemsDeleted = 0;
    try {
      const entries = await getDirectoryEntries(folderPath);
      for (const entry of entries) {
        const itemPath = join(folderPath, entry.name);
        try {
          if (entry.isDirectory()) {
            await deleteDirectory(itemPath);
          } else if (entry.isFile() || entry.isSymbolicLink()) {
            await deleteFileOrLink(itemPath);
          } else {
            await rm(itemPath, { force: true });
          }
          itemsDeleted++;
        } catch (error) {
          return {
            success: false,
            folderPath,
            error: (error as Error).message || /* istanbul ignore next */ 'Unknown error',
            partiallyDeleted: itemsDeleted,
          };
        }
      }
      return {
        success: true,
        folderPath,
        itemsDeleted,
      };
    } catch (error) {
      return {
        success: false,
        folderPath,
        error: (error as Error).message || /* istanbul ignore next */ 'Unknown error',
        partiallyDeleted: itemsDeleted,
      };
    }
  }
}
