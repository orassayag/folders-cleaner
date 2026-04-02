export interface Settings {
  targetPath: string;
}

export interface FolderScanResult {
  path: string;
}

export type CleanResult =
  | {
      success: true;
      folderPath: string;
      itemsDeleted: number;
    }
  | {
      success: false;
      folderPath: string;
      error: string;
      partiallyDeleted: number;
    };

export interface ProgressInfo {
  current: number;
  total: number;
  currentFolder: string;
}
