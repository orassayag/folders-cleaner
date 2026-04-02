import { settings } from './settings.js';
import { validateAndResolvePath } from './utils/pathValidator.js';
import { Scanner } from './core/scanner.js';
import { Cleaner } from './core/cleaner.js';
import { formatPath } from './utils/fileUtils.js';
import { ProgressInfo } from './types/index.js';

function validateSettings(): void {
  if (!settings.targetPath || settings.targetPath.trim() === '') {
    console.error('\n❌ Error: Configuration Required\n');
    console.error('  Please set a valid targetPath in src/settings.ts\n');
    console.error('  Current value: (empty)\n');
    process.exit(1);
  }
  if (settings.targetPath === '/path/to/target') {
    console.error('\n❌ Error: Configuration Required\n');
    console.error('  Please set a valid targetPath in src/settings.ts\n');
    console.error(`  Current value: "${settings.targetPath}" (placeholder)\n`);
    process.exit(1);
  }
}

function displayProgress(info: ProgressInfo): void {
  const formattedPath = formatPath(info.currentFolder);
  const progressText = `Processing: [${info.current}/${info.total}] ${formattedPath}...`;
  if (process.stdout.isTTY) {
    process.stdout.write('\r' + ' '.repeat(100) + '\r');
    process.stdout.write(progressText);
  } else {
    console.log(progressText);
  }
}

async function main(): Promise<void> {
  try {
    console.log('\n🗑️  Folders Cleaner\n');
    validateSettings();
    const resolvedPath = await validateAndResolvePath(settings.targetPath);
    if (resolvedPath !== settings.targetPath) {
      console.log(`Target: ${resolvedPath} (resolved from ${settings.targetPath})`);
    } else {
      console.log(`Target: ${resolvedPath}`);
    }
    const scanner = new Scanner();
    console.log('Scanning first-level subdirectories...');
    const folders = await scanner.scanFirstLevelFolders(resolvedPath);
    if (folders.length === 0) {
      console.log(`No subdirectories found in ${resolvedPath}\n`);
      console.log('✅ Done!\n');
      process.exit(0);
    }
    console.log(`Found ${folders.length} folders to clean\n`);
    console.log('Cleaning folders...');
    const cleaner = new Cleaner();
    const results = await cleaner.clean(folders, displayProgress);
    if (process.stdout.isTTY) {
      process.stdout.write('\r' + ' '.repeat(100) + '\r');
    } else {
      console.log('');
    }
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const totalItemsDeleted = results.reduce((sum, r) => {
      return sum + (r.success ? r.itemsDeleted : r.partiallyDeleted);
    }, 0);
    if (failureCount === 0) {
      console.log(`\n✅ Successfully cleaned ${successCount}/${folders.length} folders`);
      console.log(`Total items deleted: ${totalItemsDeleted}\n`);
      console.log('✅ Done!\n');
      process.exit(0);
    } else {
      console.log(`\n⚠️  Cleaned ${successCount}/${folders.length} folders (${failureCount} failed)`);
      console.log(`Total items deleted: ${totalItemsDeleted}\n`);
      console.log('Failed folders:');
      for (const result of results) {
        if (!result.success) {
          console.log(`  • ${formatPath(result.folderPath)}: ${result.error}`);
        }
      }
      console.log('\n✅ Done!\n');
      process.exit(1);
    }
  } catch (error) {
    const errorMessage = (error as Error).message || 'Unknown error';
    if (errorMessage.includes('Target folder not found')) {
      console.error('\n❌ Error: Target folder not found\n');
      console.error(`  Path: ${settings.targetPath}\n`);
      console.error('  Please check:');
      console.error('  • Is the path spelled correctly?');
      console.error('  • Does the folder exist?\n');
    } else if (errorMessage.includes('Target must be a folder')) {
      console.error('\n❌ Error: Target must be a folder, not a file\n');
      console.error(`  Path: ${settings.targetPath}\n`);
      console.error('  Please provide a folder path in src/settings.ts\n');
    } else if (errorMessage.includes('Cannot clean protected system path')) {
      console.error('\n❌ Error: Cannot clean protected system path\n');
      console.error(`  Path: ${settings.targetPath}\n`);
      console.error('  This path is protected for your safety.');
      console.error('  Please choose a different folder.\n');
    } else if (errorMessage.includes('Permission denied')) {
      console.error('\n❌ Error: Permission denied\n');
      console.error(`  Path: ${settings.targetPath}\n`);
      console.error("  You don't have permission to access this folder.");
      console.error('  Please check folder permissions or choose a different path.\n');
    } else {
      console.error('\n❌ Fatal Error\n');
      console.error(`  ${errorMessage}\n`);
    }
    process.exit(1);
  }
}

main();
