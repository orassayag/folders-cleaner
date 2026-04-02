# Contributing to Folders Cleaner

First off, thank you for considering contributing to Folders Cleaner! It's people like you that make this tool better for everyone.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project and everyone participating in it is governed by a simple principle: **Be respectful and constructive**. By participating, you are expected to uphold this standard.

## Getting Started

- Make sure you have [Node.js](https://nodejs.org/) (v18+) and [pnpm](https://pnpm.io/) installed
- Fork the repository on GitHub
- Clone your fork locally
- Create a branch for your contribution

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (code snippets, command output)
- **Describe the behavior you observed** and what you expected
- **Include your environment details** (OS, Node version, pnpm version)
- **Include your settings.ts configuration** (sanitize any sensitive paths)

### Suggesting Enhancements

Enhancement suggestions are welcome! Please provide:

- **A clear and descriptive title**
- **A detailed description** of the suggested enhancement
- **Explain why this enhancement would be useful**
- **Provide examples** of how it would work
- **Consider cross-platform compatibility** (Mac, Linux, Windows)

### Your First Code Contribution

Unsure where to begin? Look for issues labeled:

- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `documentation` - Improvements to documentation

## Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/yourusername/folders-cleaner.git
   cd folders-cleaner
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build the project**
   ```bash
   pnpm build
   ```

4. **Run tests**
   ```bash
   pnpm test
   ```

5. **Run linting**
   ```bash
   pnpm lint
   ```

## Coding Standards

### TypeScript Guidelines

- **Use TypeScript** for all code
- **Explicit typing** - Avoid `any` unless absolutely necessary
- **Functional approach** - Prefer pure functions and immutability
- **Clear naming** - Use descriptive variable and function names
- **Cross-platform** - Always consider Mac, Linux, and Windows compatibility

### Code Style

- **Formatting** - Run `pnpm prettier:fix` before committing
- **Linting** - Run `pnpm lint:fix` to fix linting issues
- **No console.log** - Use proper error handling instead (except for user-facing output)
- **Comments** - Add comments for non-obvious logic, not what the code does

### File Organization

```
src/
├── core/           # Core business logic (Scanner, Cleaner)
├── utils/          # Utility functions (pathValidator, fileUtils)
├── types/          # TypeScript type definitions
└── __tests__/      # Test files (colocated with source)
```

### Example Code Style

```typescript
export async function validateAndResolvePath(targetPath: string): Promise<string> {
  if (!targetPath || targetPath.trim() === '') {
    throw new Error('Target path cannot be empty');
  }
  const resolvedPath = resolve(targetPath);
  const stats = await stat(resolvedPath);
  if (!stats.isDirectory()) {
    throw new Error(`Target must be a folder, not a file: ${resolvedPath}`);
  }
  if (isProtectedPath(resolvedPath)) {
    throw new Error(`Cannot clean protected system path: ${resolvedPath}`);
  }
  await validatePathPermissions(resolvedPath);
  return resolvedPath;
}
```

### Cross-Platform Considerations

When writing code that touches file system paths:

- **Use `path` module** - Always use Node.js `path` module for path operations
- **Test on multiple OS** - If possible, test on Mac/Linux and Windows
- **Path separators** - Use `path.sep`, `path.join()`, never hardcode `/` or `\`
- **Case sensitivity** - Remember Windows is case-insensitive, Unix is case-sensitive
- **Protected paths** - Different OS have different system directories to protect

## Testing Guidelines

### Writing Tests

- **Test files** - Place in `__tests__` directories next to source files
- **Naming** - Use `.test.ts` suffix (e.g., `scanner.test.ts`)
- **Coverage** - Aim for high test coverage of business logic
- **Unit tests** - Test individual functions in isolation
- **Integration tests** - Test full workflows in `src/__tests__/`
- **Mock external dependencies** - Use Vitest mocks when appropriate
- **Temp directories** - Use `mkdtemp()` for test fixtures, clean up in `afterEach()`

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Scanner } from '../../core/scanner.js';

describe('Scanner', () => {
  let tempDir: string;
  let scanner: Scanner;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'folders-cleaner-test-'));
    scanner = new Scanner();
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('scanFirstLevelFolders', () => {
    it('should return only first-level directories', async () => {
      await mkdir(join(tempDir, 'folder1'));
      await mkdir(join(tempDir, 'folder2'));
      const results = await scanner.scanFirstLevelFolders(tempDir);
      expect(results).toHaveLength(2);
    });
  });
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
NODE_OPTIONS='--no-warnings' vitest run src/core/__tests__/scanner.test.ts
```

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring without changing functionality
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependency updates

### Examples

```
feat(cleaner): add progress callback for real-time updates

Added optional callback parameter to Cleaner.clean() method that
reports cleaning progress for each folder. This enables real-time
UI updates showing current folder and completion ratio.

Closes #123
```

```
fix(pathValidator): handle Windows UNC paths correctly

Changed path validation to properly detect and validate Windows
UNC paths (\\server\share format).

Fixes #456
```

```
docs(readme): add Windows path examples

Added comprehensive examples of Windows path formats in the
Configuration section to help Windows users.
```

## Pull Request Process

### Before Submitting

1. **Update tests** - Add/update tests for your changes
2. **Run the test suite** - `pnpm test`
3. **Run linting** - `pnpm lint:fix`
4. **Run formatting** - `pnpm prettier:fix`
5. **Update documentation** - If you changed functionality
6. **Test manually** - Run the tool with your changes (use a safe test directory!)
7. **Test cross-platform** - If touching path logic, test on different OS if possible

### Submitting

1. **Push your branch** to your fork
2. **Open a Pull Request** against the `main` branch
3. **Fill in the PR template** with all relevant details
4. **Link related issues** using "Fixes #123" or "Closes #456"

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] Added/updated tests
- [ ] Tested manually on Mac/Linux
- [ ] Tested manually on Windows (if applicable)

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Cross-platform compatibility considered
```

### Review Process

- **Code review** - Maintainers will review your PR
- **Feedback** - Address any requested changes
- **Approval** - Once approved, your PR will be merged
- **Credit** - You'll be credited in the release notes!

## Development Tips

### Debugging

```bash
# Run with debugging
node --inspect-brk node_modules/.bin/tsx src/main.ts
```

### Testing Locally

```bash
# Create a safe test directory
mkdir -p ~/test-folders-cleaner/folder1/subfolder
echo "test" > ~/test-folders-cleaner/folder1/file.txt

# Edit src/settings.ts
# targetPath: "/Users/yourusername/test-folders-cleaner"

# Run the tool
pnpm start

# Verify results
ls -la ~/test-folders-cleaner/folder1
```

### Testing on Windows

```powershell
# Create test directory
New-Item -ItemType Directory -Path "C:\test-folders-cleaner\folder1\subfolder"
"test" | Out-File "C:\test-folders-cleaner\folder1\file.txt"

# Edit src/settings.ts
# targetPath: "C:/test-folders-cleaner"

# Run the tool
pnpm start

# Verify results
Get-ChildItem "C:\test-folders-cleaner\folder1"
```

### Performance Testing

```bash
# Use time command to measure performance
time pnpm start
```

## Safety Guidelines

When contributing features that touch file system operations:

1. **Always validate paths** - Use pathValidator module
2. **Protect system directories** - Update protected paths list if needed
3. **Handle errors gracefully** - Don't crash on permission errors
4. **Test deletion carefully** - Use temporary directories for tests
5. **Document risks** - Update README warnings if adding risky features

## Questions?

Feel free to open an issue with the `question` label if you have any questions about contributing!

## Recognition

Contributors will be recognized in:
- Release notes
- README.md (if significant contribution)
- GitHub contributors page

Thank you for making Folders Cleaner better! 🎉
