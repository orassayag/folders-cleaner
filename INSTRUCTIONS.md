# Folders Cleaner - Developer Instructions

This document provides detailed instructions for developers working on the Folders Cleaner project.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Setup Instructions](#setup-instructions)
- [Development Workflow](#development-workflow)
- [Module Documentation](#module-documentation)
- [Testing Strategy](#testing-strategy)
- [Cross-Platform Development](#cross-platform-development)
- [Troubleshooting](#troubleshooting)

## Project Overview

### Purpose

Folders Cleaner is a TypeScript CLI tool designed to clear all files from first-level subfolders while preserving the folder structure. The tool provides:

- First-level directory scanning (non-recursive)
- Sequential folder cleaning with progress tracking
- Comprehensive path validation and protection
- Cross-platform support (Mac, Linux, Windows)
- Clear error handling and user feedback

### Target Users

- Developers needing to clean project output folders
- Anyone managing folder structures with temporary contents
- Users who want to preserve folder hierarchy but clear contents
- Developers working with test output directories

### Key Goals

1. **Safety First** - Protected path validation prevents system damage
2. **Structure Preservation** - Keep folders, remove only contents
3. **User Feedback** - Real-time progress during operations
4. **Cross-Platform** - Works reliably on Mac, Linux, and Windows
5. **Clear Errors** - User-friendly error messages for common issues

## Architecture

### High-Level Design

```
User Input (settings.ts)
        ↓
    main.ts (Orchestrator)
        ↓
    PathValidator (Validation)
        ↓
    Scanner (First-level scan)
        ↓
    Cleaner (Sequential deletion)
        ↓
    Console Output
```

### Module Responsibilities

| Module | Responsibility | Key Functions |
|--------|---------------|---------------|
| `main.ts` | Entry point and orchestration | Validates settings, coordinates workflow, displays results |
| `scanner.ts` | First-level scanning | Finds immediate subdirectories only |
| `cleaner.ts` | Sequential deletion | Deletes contents of folders one by one |
| `pathValidator.ts` | Path security | Validates, resolves, and protects paths |
| `fileUtils.ts` | File operations | Helper functions for file system operations |

### Data Flow

1. **Configuration Loading** (`settings.ts`)
   - Load user configuration
   - Validate settings (not empty, not placeholder)

2. **Path Validation** (`pathValidator.ts`)
   - Resolve to absolute path
   - Verify path exists and is directory
   - Check not protected system path
   - Validate permissions

3. **Scanning Phase** (`scanner.ts`)
   - Read first-level subdirectories only
   - Skip files and symlinks
   - Return list of folders to clean

4. **Cleaning Phase** (`cleaner.ts`)
   - Process folders sequentially
   - For each folder:
     - Read immediate children
     - Delete each child (files, folders, symlinks)
     - Track successful deletions
     - Handle errors gracefully
   - Report progress after each folder

5. **Reporting Phase** (`main.ts`)
   - Display success/failure counts
   - Show total items deleted
   - List failed folders with errors
   - Exit with appropriate code

## Setup Instructions

### Prerequisites

- **Node.js** v18.0.0 or higher
- **pnpm** v8.0.0 or higher
- **Git** for version control

### Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/orassayag/folders-cleaner
cd folders-cleaner

# 2. Install dependencies
pnpm install

# 3. Build the project
pnpm build

# 4. Verify setup
pnpm test
pnpm lint
```

### IDE Configuration

#### VS Code (Recommended)

Install recommended extensions:
- ESLint
- Prettier
- TypeScript and JavaScript Language Features

Settings (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Development Workflow

### Daily Development

```bash
# 1. Pull latest changes
git pull origin main

# 2. Create feature branch
git checkout -b feature/your-feature-name

# 3. Make changes
# ... edit files ...

# 4. Run tests continuously
pnpm test:watch

# 5. Build and test
pnpm build
pnpm test
pnpm lint

# 6. Commit changes
git add .
git commit -m "feat: your feature description"

# 7. Push and create PR
git push origin feature/your-feature-name
```

### Adding a New Feature

1. **Design Phase**
   - Document the feature requirement
   - Design the API/interface
   - Consider cross-platform implications
   - Consider edge cases

2. **Implementation Phase**
   - Write types first (`src/types/index.ts`)
   - Implement core logic
   - Add error handling
   - Use `path` module for all path operations

3. **Testing Phase**
   - Write unit tests
   - Test edge cases
   - Test on multiple OS if possible
   - Manual testing with safe directories

4. **Documentation Phase**
   - Update JSDoc comments
   - Update README if needed
   - Add usage examples

### Making a Bug Fix

1. **Reproduce** - Create a test case that fails
2. **Fix** - Implement the fix
3. **Verify** - Ensure test passes
4. **Regress** - Run full test suite
5. **Document** - Update CHANGELOG or docs if needed

## Module Documentation

### PathValidator Module (`src/utils/pathValidator.ts`)

**Purpose**: Validate and secure paths before operations.

**Key Functions**:

```typescript
async validateAndResolvePath(targetPath: string): Promise<string>
```
- Validates path exists, is directory, has permissions
- Resolves relative paths to absolute
- Checks against protected system paths
- Returns resolved absolute path or throws error

```typescript
isProtectedPath(resolvedPath: string): boolean
```
- Checks if path is a protected system directory
- Different logic for Windows vs Unix/Mac
- Protects root, system directories, home directory, cwd

```typescript
isWindowsPath(path: string): boolean
```
- Detects Windows-style paths (drive letters, UNC paths)
- Used for validation and formatting

**Protected Paths**:
- Unix/Mac: `/`, `/etc`, `/usr`, `/bin`, `/System`, home directory
- Windows: `C:\`, `C:\Windows`, `C:\Program Files`, home directory

### Scanner Module (`src/core/scanner.ts`)

**Purpose**: Scan only first-level subdirectories.

**Key Methods**:

```typescript
async scanFirstLevelFolders(targetPath: string): Promise<FolderScanResult[]>
```

**Algorithm**:
1. Read directory entries with `fs.readdir(path, { withFileTypes: true })`
2. Filter only directories (skip files)
3. Skip symlinks at first level
4. Return list of folder paths

**Key Differences from Recursive Scanning**:
- Only looks at immediate children
- Does not traverse into subdirectories
- Much faster for large directory trees
- Simpler logic, fewer edge cases

### Cleaner Module (`src/core/cleaner.ts`)

**Purpose**: Delete contents of folders sequentially.

**Key Methods**:

```typescript
async clean(
  folders: FolderScanResult[],
  onProgress?: ProgressCallback
): Promise<CleanResult[]>
```

**Algorithm**:
1. For each folder in sequence:
   - Read immediate children with `fs.readdir()`
   - For each child:
     - If directory: use `fs.rm({ recursive: true })`
     - If file/symlink: use `fs.unlink()`
     - If special: use `fs.rm({ force: true })`
     - Track successful deletions
     - On error: stop processing folder, mark as failed
   - Preserve parent folder
   - Call progress callback
2. Return array of results (success or failure for each folder)

**Error Handling**:
- Each child deletion wrapped in try-catch
- On failure: stop that folder, record partial count, continue to next folder
- Never re-throw errors
- Return failure results with error messages

**Safety Features**:
- Sequential processing for better error tracking
- Preserves parent folders
- Continues after individual folder failures
- Detailed error messages in results

### FileUtils Module (`src/utils/fileUtils.ts`)

**Purpose**: Provide helper functions for file operations.

**Key Functions**:

```typescript
async pathExists(path: string): Promise<boolean>
async isDirectory(path: string): Promise<boolean>
async getDirectoryEntries(path: string): Promise<Dirent[]>
async deleteFileOrLink(path: string): Promise<void>
async deleteDirectory(path: string): Promise<void>
function formatPath(path: string): string
```

**Usage Notes**:
- All async functions use `fs/promises`
- Error handling done by callers
- Cross-platform compatible

### Main Module (`src/main.ts`)

**Purpose**: Entry point and workflow orchestration.

**Workflow**:
1. Validate settings (not empty, not placeholder)
2. Validate and resolve path
3. Scan for first-level folders
4. Handle empty results
5. Clean folders sequentially with progress
6. Display summary
7. Exit with appropriate code

**Error Handling**:
- Catches all errors from workflow
- Displays user-friendly error messages
- Different messages for different error types
- Always exits with code (0 for success, 1 for failure)

**Progress Display**:
- TTY mode: Uses `\r` for single-line updates
- Non-TTY mode: Uses newlines for each update
- Truncates long paths (max 60 chars)

## Testing Strategy

### Test Structure

```
src/
├── utils/
│   ├── __tests__/
│   │   ├── pathValidator.test.ts
│   │   └── fileUtils.test.ts
├── core/
│   └── __tests__/
│       ├── scanner.test.ts
│       └── cleaner.test.ts
└── __tests__/
    └── main.test.ts
```

### Unit Tests

**Path Validator Tests** (`pathValidator.test.ts`):
- Valid/invalid paths
- Relative path resolution
- Protected path detection
- Cross-platform path formats
- Windows drive letters and UNC paths
- Permission errors

**File Utils Tests** (`fileUtils.test.ts`):
- Path existence checking
- Directory detection
- Entry reading
- Deletion operations
- Path formatting

**Scanner Tests** (`scanner.test.ts`):
- First-level directory detection
- File and symlink skipping
- Empty directory handling
- Permission errors

**Cleaner Tests** (`cleaner.test.ts`):
- Content deletion while preserving folders
- Hidden file handling
- Nested directory deletion
- Sequential processing
- Error handling and partial deletion
- Progress callback
- Edge cases (unicode, spaces)

### Integration Tests

**Main Workflow Tests** (`main.test.ts`):
- Full workflow from validation to cleaning
- Settings validation scenarios
- Protected path rejection
- Empty target handling
- Progress tracking
- Relative path handling
- TTY vs non-TTY progress display

### Running Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Specific test file
NODE_OPTIONS='--no-warnings' vitest run src/core/__tests__/scanner.test.ts

# With debugging
node --inspect-brk node_modules/.bin/vitest run
```

### Test Best Practices

1. **Use temp directories** - Always use `mkdtemp()` for test fixtures
2. **Clean up** - Always clean up in `afterEach()`
3. **Cross-platform** - Use `path.join()`, never hardcode separators
4. **Edge cases** - Test unicode, spaces, special characters
5. **Error cases** - Test error handling, not just happy path

## Cross-Platform Development

### Path Handling

**Always**:
- Use `path.resolve()` for absolute paths
- Use `path.join()` for combining paths
- Use `path.sep` for OS-specific separator
- Use `path.normalize()` for cleaning paths

**Never**:
- Hardcode `/` or `\` in paths
- Assume case sensitivity
- Assume path length limits

### Testing Cross-Platform

```typescript
// Good - works on all platforms
const filePath = join(tempDir, 'subfolder', 'file.txt');

// Bad - only works on Unix
const filePath = `${tempDir}/subfolder/file.txt`;

// Good - handles both OS
if (process.platform === 'win32') {
  // Windows-specific logic
} else {
  // Unix/Mac logic
}

// Good - mock both path formats in tests
it('should handle Windows paths', () => {
  expect(isWindowsPath('C:\\Users\\test')).toBe(true);
});

it('should handle Unix paths', () => {
  expect(isWindowsPath('/Users/test')).toBe(false);
});
```

### Windows-Specific Considerations

- Drive letters: `C:`, `D:`, etc.
- UNC paths: `\\server\share`
- Path length limit: 260 characters (MAX_PATH)
- Case insensitivity
- Reserved names: CON, PRN, AUX, NUL, COM1-9, LPT1-9
- Backslash separators (but forward slashes work too)

### Mac/Linux-Specific Considerations

- Case sensitivity (usually, but not always)
- Hidden files start with `.`
- Symlink handling
- Permission model differences
- No drive letters, absolute paths start with `/`

## Troubleshooting

### Build Errors

**Issue**: TypeScript compilation errors

**Solution**:
```bash
pnpm install
pnpm build
```

### Test Failures

**Issue**: Tests fail on Windows but pass on Mac

**Solution**:
- Check path separator usage
- Check case sensitivity assumptions
- Review cross-platform test mocks

**Issue**: Permission errors in tests

**Solution**:
- Ensure temp directories are being cleaned up
- Check file/folder permissions
- May need to skip some tests in CI environments

### Runtime Errors

**Issue**: "Target folder not found"

**Solution**:
- Verify path in `settings.ts` exists
- Check for typos
- Try absolute path instead of relative

**Issue**: "Permission denied"

**Solution**:
- Check folder permissions
- Ensure user has read/write access
- On Windows, check folder isn't locked by another process

**Issue**: "Cannot clean protected system path"

**Solution**:
- This is a safety feature
- Choose a different, non-system folder
- Never disable this check

### Development Issues

**Issue**: ESLint/Prettier conflicts

**Solution**:
```bash
pnpm lint:fix
pnpm prettier:fix
```

**Issue**: Vitest warnings

**Solution**:
- Always run tests with `NODE_OPTIONS='--no-warnings'`
- Or use the npm scripts: `pnpm test`

## Performance Optimization

### Current Approach

- Sequential folder processing for reliability
- Async/await for non-blocking I/O
- Atomic directory deletion with `fs.rm({ recursive: true })`
- Count only immediate children (not nested items)

### Future Optimizations

If performance becomes an issue:
1. Parallel folder cleaning (with concurrency limit)
2. Streaming directory reads for very large folders
3. Progress throttling (update every N folders instead of every folder)

## Security Considerations

### Path Validation

- Always validate before any file operation
- Resolve relative paths to absolute
- Check against protected system paths
- Validate permissions early

### Error Messages

- Don't expose internal system paths in production
- Sanitize error messages
- Provide clear guidance to users

### Safe Defaults

- No placeholder paths in settings
- Protected paths list is comprehensive
- Permission checks before operations
- Clear warnings in documentation

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Need Help?**

- Open an issue on GitHub
- Check existing issues and documentation
- Read the [README.md](README.md) for usage examples
