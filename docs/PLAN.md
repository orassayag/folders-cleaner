# Build Folders Cleaner App

## Project Structure

The app will be created in `/Users/orassayag/Repos/folders-cleaner` with the following structure based on [`node-modules-remover`](https://github.com/orassayag/node-modules-remover):

```
folders-cleaner/
├── src/
│   ├── main.ts              # Entry point
│   ├── settings.ts          # Configuration
│   ├── types/
│   │   └── index.ts         # TypeScript interfaces
│   ├── core/
│   │   ├── scanner.ts       # Scans first-level subfolders
│   │   └── cleaner.ts       # Deletes files from folders
│   ├── utils/
│   │   ├── fileUtils.ts     # Helper functions
│   │   ├── pathValidator.ts # Path validation and security
│   │   └── __tests__/       # Unit tests
│   │       ├── fileUtils.test.ts
│   │       ├── pathValidator.test.ts
│   │       ├── scanner.test.ts
│   │       └── cleaner.test.ts
│   └── __tests__/           # Integration tests
│       └── main.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.json
├── .prettierrc.json
├── .gitignore
└── README.md
```

## Core Functionality

### 1. Settings Configuration ([`src/settings.ts`](src/settings.ts))

Based on [`/Users/orassayag/Repos/node-modules-remover/src/settings.ts`](/Users/orassayag/Repos/node-modules-remover/src/settings.ts), create simplified settings:

```typescript
export const settings: Settings = {
  targetPath: '/path/to/target',
};
```

**Cross-Platform Path Examples:**

Mac/Linux:

```typescript
targetPath: '/Users/username/projects/test';
targetPath: './relative/path';
targetPath: '../parent/path';
```

Windows (all formats work - Node.js normalizes them):

```typescript
targetPath: 'C:\\Users\\username\\projects\\test'; // Escaped backslashes
targetPath: 'C:/Users/username/projects/test'; // Forward slashes (recommended)
targetPath: 'D:\\projects\\test';
targetPath: '.\\relative\\path'; // Relative path
targetPath: '\\\\server\\share\\folder'; // UNC network path
```

**Recommended:** Use forward slashes even on Windows for simplicity - Node.js handles the conversion automatically.

### 2. Types Definition ([`src/types/index.ts`](src/types/index.ts))

Define interfaces for:

```typescript
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
```

### 3. Path Validator Module ([`src/utils/pathValidator.ts`](src/utils/pathValidator.ts))

NEW module for comprehensive path validation and security:

**Responsibilities:**

- Validate path exists (throw error if not)
- Validate path is a directory (throw error if file)
- Handle both absolute and relative paths using `path.resolve()`
- Handle both Mac and Windows path formats:
  - Use `path.normalize()` to convert mixed separators to OS-specific format
  - Use `path.sep` to detect OS-specific separator
  - Accept forward slashes on Windows (Node.js converts automatically)
  - Handle UNC paths on Windows (`\\server\share`)
  - Validate Windows drive letters (C:, D:, etc.)
- Protect sensitive system paths (throw error for dangerous paths)
- Throw error on permission issues (EACCES, EPERM)

**Protected Paths (throw error if target matches):**

**Unix/Mac:**

- Root paths: `/`
- System directories: `/etc`, `/usr`, `/bin`, `/sbin`, `/System`, `/Library`, `/Applications`
- User home directory: `~`, `$HOME`, resolved home path
- Parent of home directory
- Current working directory and its parents (up to 2 levels)

**Windows:**

- Root paths: `C:\`, `D:\`, etc. (any drive root)
- System directories: `C:\Windows`, `C:\Program Files`, `C:\Program Files (x86)`, `C:\ProgramData`
- User home directory: `%USERPROFILE%`, `C:\Users\Username`
- Parent of home directory (`C:\Users`)
- Current working directory and its parents (up to 2 levels)
- System32: `C:\Windows\System32`

**Functions:**

```typescript
export function validateAndResolvePath(targetPath: string): string;
export function isProtectedPath(resolvedPath: string): boolean;
export function isWindowsPath(path: string): boolean;
export async function validatePathPermissions(
  resolvedPath: string
): Promise<void>;
```

**Windows-Specific Validation:**

```typescript
// Check if path is Windows format (has drive letter or UNC)
function isWindowsPath(pathStr: string): boolean {
  // Drive letter: C:, D:, etc.
  const drivePattern = /^[a-zA-Z]:\\/;
  // UNC path: \\server\share
  const uncPattern = /^\\\\/;
  return drivePattern.test(pathStr) || uncPattern.test(pathStr);
}

// Validate Windows drive letter exists
async function validateWindowsDrive(driveLetter: string): Promise<void> {
  // On Windows, check if drive is accessible
  // On Unix/Mac, this validation is skipped
}
```

### 4. Scanner Module ([`src/core/scanner.ts`](src/core/scanner.ts))

Simplified version of [`/Users/orassayag/Repos/node-modules-remover/src/core/scanner.ts`](/Users/orassayag/Repos/node-modules-remover/src/core/scanner.ts):

- Read only first-level subdirectories of the target path using `fs.readdir(path, { withFileTypes: true })`
- Filter only directories (skip files)
- Skip symlinks at the first level (check with `entry.isSymbolicLink()`)
- Return list of `FolderScanResult` objects with just the path
- If no subdirectories found, return empty array (caller will handle completion)
- Throw error on permission issues (EACCES, EPERM)

### 5. Cleaner Module ([`src/core/cleaner.ts`](src/core/cleaner.ts))

Based on [`/Users/orassayag/Repos/node-modules-remover/src/core/remover.ts`](/Users/orassayag/Repos/node-modules-remover/src/core/remover.ts):

**Deletion Strategy:**

- Process first-level folders sequentially (one at a time for better error tracking and progress reporting)
- For each first-level subfolder:
  1. Use `fs.readdir(path, { withFileTypes: true })` to get immediate children
  2. Loop through each child using async/await with try-catch:
     - If directory: Use `fs.rm(childPath, { recursive: true, force: true })` to delete entire subtree atomically
     - If file or symlink: Use `fs.unlink(childPath)` to delete the file
     - If special file type: `fs.rm(childPath, { force: true })`
     - Track successful deletions in `itemsDeleted` counter
     - If ANY deletion fails, catch error and mark folder as failed
  3. Record result with items deleted count (for success) or error message with partial count (for failure)
- Delete all items including hidden files and folders
- Preserve the parent folder itself
- Count only immediate children deleted (not nested items inside subdirectories)
- If deletion fails for any child, mark entire folder result as failed but continue with remaining folders
- Handle permission errors gracefully - record error and continue with next folder

**Progress Callback:**

```typescript
export type ProgressCallback = (info: ProgressInfo) => void;

async clean(
  folders: FolderScanResult[],
  onProgress?: ProgressCallback
): Promise<CleanResult[]>
```

**Error Handling:**

- Each child deletion wrapped in individual try-catch
- If any child fails: stop processing that folder, mark as failed, record partial success count
- Continue with next folder even if previous folder failed
- Do not re-throw errors - return failure results instead

### 6. Main Entry Point ([`src/main.ts`](src/main.ts))

Based on [`/Users/orassayag/Repos/node-modules-remover/src/main.ts`](/Users/orassayag/Repos/node-modules-remover/src/main.ts):

**Flow:**

1. Read settings from `settings.ts`
2. Validate settings (ensure targetPath is not empty or placeholder)
3. Validate and resolve target path using `pathValidator`
4. Initialize scanner and cleaner
5. Log operation start with resolved path
6. Scan for first-level subfolders
7. Handle empty results: if no folders found, log "No subdirectories found" and exit with code 0
8. Display progress bar during cleaning (using simple console progress with TTY detection)
9. Clean each folder sequentially (await each clean operation)
10. Display completion summary with success/failure counts
11. Exit with code 0 if all succeeded, code 1 if any failures

**Progress Bar Implementation:**

- Use simple text-based progress: `Processing: [3/10] folder-name...`
- Update on each folder completion
- Truncate long paths for display: paths longer than 60 chars shown as `...last-57-chars`
- Handle TTY vs non-TTY environments:
  - If `process.stdout.isTTY`: Use carriage return (`\r`) for single-line updates
  - If not TTY (CI/CD): Use newlines for each update
- Clear any previous line content with spaces before writing new progress

**Error Handling:**

- Validate settings before starting (see Settings Validation section below)
- Catch validation errors and display clear, user-friendly error messages
- Catch permission errors and exit with code 1
- Wrap entire main() in try-catch, log fatal errors

**Settings Validation:**

- Check `targetPath` is not empty string: `if (!settings.targetPath)`
- Check `targetPath` is not placeholder: `if (settings.targetPath === '/path/to/target')`
- Throw descriptive error: `"Please configure targetPath in src/settings.ts before running"`
- Display error with formatting:

  ```
  ❌ Error: Configuration Required

    Please set a valid targetPath in src/settings.ts

    Current value: "/path/to/target" (placeholder)
  ```

### 7. Utility Functions ([`src/utils/fileUtils.ts`](src/utils/fileUtils.ts))

Helper functions for:

- `async function pathExists(path: string): Promise<boolean>` - Check if path exists
- `async function isDirectory(path: string): Promise<boolean>` - Check if path is a directory
- `async function getDirectoryEntries(path: string): Promise<Dirent[]>` - Wrapper around fs.readdir
- `async function deleteFileOrLink(path: string): Promise<void>` - Delete file or symlink
- `async function deleteDirectory(path: string): Promise<void>` - Delete directory recursively
- `function formatPath(path: string): string` - Format path for display (cross-platform)

### 8. Testing Strategy

**Test Structure:**

All tests use `vitest` with `NODE_OPTIONS='--no-warnings'` as per user rules.

#### Unit Tests ([`src/utils/__tests__/`](src/utils/__tests__/))

**`pathValidator.test.ts`:**

- Test valid absolute paths (Mac: `/Users/test/folder`, Windows: `C:\Users\test\folder` and `C:/Users/test/folder`)
- Test valid relative paths (`./test`, `../test`, `test/folder`)
- Test path resolution to absolute paths on both platforms
- Test Windows drive letter formats: `C:\`, `D:\`, with both `\` and `/` separators
- Test Windows UNC paths: `\\server\share\folder`
- Test mixed separators on Windows: `C:\path/to\folder` (should normalize)
- Test protected path rejection:
  - Unix: `/`, `/etc`, `/usr`, home directory
  - Windows: `C:\`, `C:\Windows`, `C:\Program Files`, `%USERPROFILE%`
- Test non-existent path throws error
- Test file path (not directory) throws error
- Test permission errors throw error (mock or skip on CI)
- Test path normalization for both Mac and Windows
- Test invalid Windows paths: `Z:\nonexistent` (invalid drive)
- Test case sensitivity differences (Windows case-insensitive, Unix case-sensitive)

**`fileUtils.test.ts`:**

- Test `pathExists()` with existing and non-existing paths
- Test `isDirectory()` with files and directories
- Test utility functions with temp directories

**`scanner.test.ts`:**

- Create temp directory structure in `beforeEach`
- Test scanning returns only first-level directories
- Test scanning skips files at first level
- Test scanning skips symlinks at first level
- Test empty directory returns empty array
- Test permission errors throw error (mock)
- Clean up temp directories in `afterEach`

**`cleaner.test.ts`:**

- Create temp folder structures with nested files/folders
- Test deletion removes all contents but preserves parent folder
- Test hidden files and folders are deleted
- Test nested directory trees are deleted
- Test empty folders are handled correctly
- Test symlinks inside folders are deleted (not followed)
- Test counts are accurate (itemsDeleted for immediate children only)
- Test permission errors return failure result (not throw)
- Test partial deletion tracking when some items fail
- Verify parent folder still exists after cleaning
- Test sequential processing of multiple folders
- Test continuation after folder failure

#### Integration Tests ([`src/__tests__/main.test.ts`](src/__tests__/main.test.ts))

- Test full workflow: validate settings -> validate path -> scan -> clean
- Test with multiple first-level folders
- Test protected path rejection
- Test empty target directory
- Test settings validation (empty path, placeholder path)
- Test progress bar in both TTY and non-TTY modes
- Mock console output for progress bar testing
- Test exit codes (0 for success, 1 for failures)

**Test Fixture Strategy:**

- Use `fs.mkdtemp()` to create temporary test directories
- Create nested structures: files, folders, hidden items
- Create files with various names: regular, unicode (`file名.txt`), spaces (`file with spaces.txt`)
- Test special characters and edge cases in filenames
- Test very deep nested structures (10+ levels deep)
- Test read-only files (if platform supports)
- Test concurrent access scenarios
- Test large file handling
- Test symlink loops detection
- Test Windows vs Mac path formats in mock tests
- Clean up all temp directories in `afterEach`
- Use `path.join()` for cross-platform path construction

## Configuration Files

### [`package.json`](package.json)

Based on [`/Users/orassayag/Repos/node-modules-remover/package.json`](/Users/orassayag/Repos/node-modules-remover/package.json) with updated:

```json
{
  "name": "folders-cleaner",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "description": "CLI tool that clears all files from first-level subfolders while preserving the folder structure",
  "keywords": [
    "folder-cleanup",
    "disk-space",
    "cli",
    "typescript",
    "filesystem",
    "developer-tools",
    "nodejs",
    "storage-management"
  ],
  "author": "Or Assayag",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/orassayag/folders-cleaner"
  },
  "bugs": {
    "url": "https://github.com/orassayag/folders-cleaner/issues"
  },
  "homepage": "https://github.com/orassayag/folders-cleaner#readme",
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  },
  "scripts": {
    "start": "tsx src/main.ts",
    "build": "tsc",
    "test": "NODE_OPTIONS='--no-warnings' vitest run",
    "test:watch": "NODE_OPTIONS='--no-warnings' vitest",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "prettier": "prettier --check 'src/**/*.ts'",
    "prettier:fix": "prettier --write 'src/**/*.ts'"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.37.0",
    "prettier": "^3.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.2",
    "vitest": "^2.1.9"
  }
}
```

**Usage:**

1. Edit `src/settings.ts` to set `targetPath` (can use env variables)
2. Run `pnpm install` to install dependencies
3. Run `pnpm start` to execute the cleaner

### [`tsconfig.json`](tsconfig.json)

Use identical configuration from [`/Users/orassayag/Repos/node-modules-remover/tsconfig.json`](/Users/orassayag/Repos/node-modules-remover/tsconfig.json):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@types/*": ["./src/types/*"],
      "@core/*": ["./src/core/*"],
      "@utils/*": ["./src/utils/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### [`vitest.config.ts`](vitest.config.ts)

Copy from node-modules-remover:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      enabled: false,
    },
  },
});
```

### [`.eslintrc.json`](.eslintrc.json)

Copy from node-modules-remover:

```json
{
  "parser": "@typescript-eslint/parser",
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "plugins": ["@typescript-eslint"],
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { "argsIgnorePattern": "^_" }
    ]
  },
  "env": {
    "node": true,
    "es2022": true
  }
}
```

### [`.prettierrc.json`](.prettierrc.json)

Copy from node-modules-remover:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### [`.gitignore`](.gitignore)

Standard Node.js gitignore:

```
.pnpm-store/
node_modules/
dist/
build/
*.log
.DS_Store
.env
.env.local
coverage/
*.tsbuildinfo
```

### [`README.md`](README.md)

Based on node-modules-remover README structure, adapted for folders-cleaner:

**Sections to Include:**

- Project title and badges (License: MIT, TypeScript, Node.js version)
- Why Folders Cleaner? (Purpose and benefits)
- Features list
- Architecture diagrams (System Flow, Module Interaction, Data Flow) - adapted to folders-cleaner logic
- Installation instructions
- Configuration (settings.ts explanation)
- Usage examples (with expected output)
- Development section (available scripts)
- Project structure
- How It Works (detailed explanation)
- Safety features
- Example scenarios
- Performance notes
- Troubleshooting
- License information
- Contributing guide reference
- Contact and support information
- **⚠️ WARNING section** about data loss and safety

### [`CONTRIBUTING.md`](CONTRIBUTING.md)

Copy from [`/Users/orassayag/Repos/node-modules-remover/CONTRIBUTING.md`](/Users/orassayag/Repos/node-modules-remover/CONTRIBUTING.md) with:

- Adapted references from "node-modules-remover" to "folders-cleaner"
- Same structure: Code of Conduct, Getting Started, Development Setup, Coding Standards, Testing Guidelines, Commit Message Guidelines, Pull Request Process
- Keep all coding standards and best practices

### [`INSTRUCTIONS.md`](INSTRUCTIONS.md)

Copy from [`/Users/orassayag/Repos/node-modules-remover/INSTRUCTIONS.md`](/Users/orassayag/Repos/node-modules-remover/INSTRUCTIONS.md) with:

- Adapted to folders-cleaner architecture (Scanner, Cleaner, PathValidator modules)
- Update module documentation to reflect folders-cleaner specific logic
- Keep development workflow, testing strategy, and best practices sections

## Key Differences from node-modules-remover

1. **Simpler scanning**: Only scan first-level subfolders, no recursive directory traversal
2. **Different deletion logic**: Delete contents of folders but preserve the folders themselves, not entire directory trees
3. **Different counting**: Count only immediate children deleted, not nested items (performance optimization)
4. **Sequential folder processing**: Process folders one at a time with async/await loops instead of parallel processing
5. **Error handling difference**: Return error results instead of throwing, continue processing after failures
6. **No statistics module**: No detailed statistics collection or display beyond success/failure counts
7. **No dry-run mode**: Direct execution only
8. **No ignore paths**: No need for path filtering
9. **Simple progress bar**: Text-based progress indicator with TTY detection instead of real-time statistics
10. **Path validation**: Enhanced validation for both Mac and Windows, with protected path checks
11. **Comprehensive testing**: Full test suite with vitest covering unit and integration tests including edge cases
12. **Settings validation**: Validate configuration before execution
13. **User-friendly errors**: Clear, formatted error messages for common issues

## Implementation Approach

The logic flow will be:

1. **Validate Settings**: Check targetPath is configured (not empty, not placeholder)
2. **Validate Path**: Read target path from settings, resolve to absolute path (handle relative paths), validate it exists and is a directory, check not protected path
3. **Scan**: List all first-level subdirectories (skip symlinks, skip files)
4. **Handle Empty**: If no subdirectories found, complete immediately with success message
5. **Clean**: For each subdirectory sequentially:
   - Read immediate children with `fs.readdir()`
   - Loop through children with async/await and try-catch:
     - Directories: `fs.rm(path, { recursive: true, force: true })`
     - Files/symlinks: `fs.unlink(path)`
   - Count successful deletions (immediate children only)
   - On any error: stop processing folder, record as failed with partial count
   - Update progress bar (with TTY detection)
   - Preserve the parent folder itself
6. **Report**: Display completion message with success/failure summary
7. **Exit**: Exit with appropriate code (0 for all success, 1 for any failures)

**Cross-Platform Considerations:**

- Use `path.resolve()` for path resolution (works on both Windows and Unix)
- Use `path.sep` and `path.normalize()` for path operations (OS-aware)
- Use `path.join()` for constructing paths (automatically uses correct separator)
- Accept forward slashes on Windows - Node.js converts them automatically
- Handle Windows drive letters: `C:`, `D:`, etc.
- Handle Windows UNC paths: `\\server\share\folder`
- Test on both Mac and Windows path formats in tests (use mocks for cross-platform testing)
- Use `process.platform` to detect OS when needed:
  ```typescript
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const isLinux = process.platform === 'linux';
  ```

## Security Considerations

Following the secure coding guidelines:

### Path Security

- **Absolute path resolution**: Always resolve to absolute path using `path.resolve()` to handle relative paths safely
- **Path existence validation**: Throw error if target path doesn't exist
- **Directory validation**: Throw error if path points to a file instead of directory
- **Protected paths**: Throw error for dangerous system paths:
  - Root directories: `/`, `C:\`, etc.
  - System directories: `/etc`, `/usr`, `/bin`, `/System`, `C:\Windows`, `C:\Program Files`
  - User home directory and its parent
  - Current working directory and ancestors (2 levels up)
- **Cross-platform support**: Handle both Mac (POSIX) and Windows path formats using Node.js `path` module
- **Windows-specific handling**:
  - Validate drive letters exist and are accessible
  - Handle UNC paths (`\\server\share`) correctly
  - Normalize mixed separators (`C:\path/to\folder` → `C:\path\to\folder`)
  - Handle MAX_PATH limit (260 characters) - document limitation
  - Handle reserved filenames (`CON`, `PRN`, `AUX`, `NUL`) - document limitation

### Permission Handling

- **Strict permission errors**: Throw error (don't silently continue) on EACCES or EPERM errors
- **Permission validation**: Check read/write permissions on target path before starting
- **Clear error messages**: Display specific error messages for permission issues

### File System Operations

- **Safe deletion**: Use `fs/promises` for all async operations
- **Atomic operations**: Use `fs.rm()` with `force: true` for reliable deletion
- **No path traversal**: All paths validated and resolved before operations
- **Symlink handling**: Skip symlinks at first level, delete (not follow) symlinks inside folders

### Error Recovery

- **Fail fast**: Throw errors immediately on validation or permission failures
- **Clear exit codes**: Exit 0 for success, 1 for any failures
- **User feedback**: Display clear error messages for all failure scenarios

### Input Validation

- **No hardcoded paths in code**: All paths come from settings.ts
- **Environment variable support**: Settings can reference environment variables
- **Path format validation**: Validate path format is valid for current OS

## Edge Cases & Error Handling

### Path Validation Errors (Display User-Friendly Message & Exit)

1. **Non-existent path**:

   ```
   ❌ Error: Target folder not found

     Path: /some/path

     Please check:
     • Is the path spelled correctly?
     • Does the folder exist?
   ```

2. **File instead of directory**:

   ```
   ❌ Error: Target must be a folder, not a file

     Path: /some/file.txt

     Please provide a folder path in src/settings.ts
   ```

3. **Protected system path**:

   ```
   ❌ Error: Cannot clean protected system path

     Path: /etc

     This path is protected for your safety.
     Please choose a different folder.
   ```

4. **Permission denied on target**:

   ```
   ❌ Error: Permission denied

     Path: /some/path

     You don't have permission to access this folder.
     Please check folder permissions or choose a different path.
   ```

5. **Unconfigured settings**:

   ```
   ❌ Error: Configuration required

     Please set a valid targetPath in src/settings.ts

     Current value: "/path/to/target" (placeholder)
   ```

### Scanning Scenarios

1. **Empty target directory**: Complete immediately with message "No subdirectories found in {path}"
2. **No subdirectories (only files)**: Same as above
3. **Symlinks at first level**: Skip them (don't include in folders to clean)
4. **Permission error during scan**: Throw error and exit

### Cleaning Scenarios (Record Error & Continue)

1. **Permission error during cleaning**: Record as failed folder, include error message, continue with next folder
2. **Hidden files/folders**: Delete all (`.git`, `.DS_Store`, etc.)
3. **Empty folders**: Process normally (no children to delete, itemsDeleted = 0)
4. **Special file types**: Delete using `fs.rm({ force: true })`
5. **Very large directories**: Handle with sequential async/await processing
6. **Partial deletion failure**: If 3/5 items deleted before error, record partiallyDeleted = 3
7. **Unicode filenames**: Handle files like `file名.txt` correctly
8. **Filenames with spaces**: Handle `file with spaces.txt` correctly
9. **Read-only files**: Attempt deletion with `force: true` flag
10. **Symlink loops**: Won't be followed (deleted at top level only)

### Progress Bar Behavior

- Display current folder being processed with truncated path (max 60 chars)
- Show completion ratio: `[3/10]`
- Update on each folder completion
- Use carriage return for TTY, newlines for non-TTY
- Final summary shows success/failure counts and total items deleted

### Exit Codes

- **0**: All operations completed successfully
- **1**: Any validation, permission, or deletion error occurred

## Example Execution Scenarios

### Scenario 1: Successful Cleaning

**Setup:**

```
/Users/test/target/
├── folder1/
│   ├── file1.txt
│   ├── nested/
│   │   └── file2.txt
│   └── .hidden
├── folder2/
│   └── data.json
└── folder3/
    (empty)
```

**Execution:**

```bash
$ pnpm start

🗑️  Folders Cleaner

Target: /Users/test/target
Scanning first-level subdirectories...
Found 3 folders to clean

Cleaning folders...
Processing: [1/3] folder1...
Processing: [2/3] folder2...
Processing: [3/3] folder3...

✅ Successfully cleaned 3/3 folders
Total items deleted: 5

✅ Done!
```

**Result:**

```
/Users/test/target/
├── folder1/  (empty - preserved)
├── folder2/  (empty - preserved)
└── folder3/  (empty - preserved)
```

### Scenario 2: No Subdirectories

**Setup:**

```
/Users/test/empty/
(no subdirectories)
```

**Execution:**

```bash
$ pnpm start

🗑️  Folders Cleaner

Target: /Users/test/empty
Scanning first-level subdirectories...
No subdirectories found in /Users/test/empty

✅ Done!
```

### Scenario 3: Protected Path Error

**Settings:**

```typescript
export const settings: Settings = {
  targetPath: '/etc',
};
```

**Execution:**

```bash
$ pnpm start

🗑️  Folders Cleaner

❌ Error: Configuration required

  Please set a valid targetPath in src/settings.ts

  Current value: "/path/to/target" (placeholder)

Process exited with code 1
```

### Scenario 4: Permission Error

**Setup:**
Folder without read permissions at `/Users/test/noperm/folder1`

**Execution:**

```bash
$ pnpm start

🗑️  Folders Cleaner

Target: /Users/test/noperm
Scanning first-level subdirectories...
Found 2 folders to clean

Cleaning folders...
Processing: [1/2] folder1...
Processing: [2/2] folder2...

⚠️  Cleaned 1/2 folders (1 failed)
Total items deleted: 15

Failed folders:
  • folder1: Permission denied (EACCES)

✅ Done!

Process exited with code 1
```

### Scenario 5: Relative Path

**Settings:**

```typescript
export const settings: Settings = {
  targetPath: './test-folders',
};
```

**Execution:**

```bash
$ pnpm start

🗑️  Folders Cleaner

Target: /Users/username/repos/folders-cleaner/test-folders (resolved from ./test-folders)
Scanning first-level subdirectories...
Found 2 folders to clean

Cleaning folders...
Processing: [1/2] folder-a...
Processing: [2/2] folder-b...

✅ Successfully cleaned 2/2 folders
Total items deleted: 19

✅ Done!
```

### Scenario 6: Protected System Path

**Settings:**

```typescript
export const settings: Settings = {
  targetPath: '/etc',
};
```

**Execution:**

```bash
$ pnpm start

🗑️  Folders Cleaner

❌ Error: Cannot clean protected system path

  Path: /etc

  This path is protected for your safety.
  Please choose a different folder.

Process exited with code 1
```

### Scenario 7: Windows Path Handling

**Settings (Windows):**

```typescript
// All these formats work on Windows:
export const settings: Settings = {
  targetPath: 'C:/Users/username/projects/test', // Forward slashes (recommended)
  // OR
  targetPath: 'C:\\Users\\username\\projects\\test', // Escaped backslashes
  // OR
  targetPath: 'D:/projects/test', // Different drive
  // OR
  targetPath: './test-folders', // Relative path
};
```

**Execution (on Windows):**

```bash
> pnpm start

🗑️  Folders Cleaner

Target: C:\Users\username\projects\test (resolved from C:/Users/username/projects/test)
Scanning first-level subdirectories...
Found 5 folders to clean

Cleaning folders...
Processing: [1/5] folder-a...
Processing: [2/5] folder-b...
Processing: [3/5] folder-c...
Processing: [4/5] folder-d...
Processing: [5/5] folder-e...

✅ Successfully cleaned 5/5 folders
Total items deleted: 42

✅ Done!
```

**Note:** Node.js automatically converts forward slashes to backslashes on Windows, so both `C:/path` and `C:\path` work identically.

**Windows Known Limitations:**

- Paths longer than 260 characters may fail (Windows MAX_PATH limit)
- Reserved filenames (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`) cannot be deleted
- File locking is more aggressive - ensure no programs are accessing the folders
