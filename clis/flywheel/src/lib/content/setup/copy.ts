import type { Dirent } from 'node:fs';
import path from 'node:path';

import { normalizeRepositoryRelativePath } from '../../repository/path.js';
import type {
  ScaffoldCopyInput,
  ScaffoldCopyTransform,
  SetupCopyResult,
} from './contract.js';
import {
  IDENTITY_TRANSFORM,
  type CopyContext,
  type MutableSetupReport,
} from './copy-context.js';
import { ensureDestinationRoot } from './copy-destination.js';
import {
  copyDirectoryEntry,
  copyFileEntry,
  type CopyDirectoryInput,
} from './copy-file.js';
import {
  readSourceEntries,
  readSourceStats,
  sortedReport,
  throwSetupError,
} from './copy-source.js';

export async function copyScaffoldTree(
  input: ScaffoldCopyInput
): Promise<SetupCopyResult> {
  const context: CopyContext = {
    destinationRoot: path.resolve(input.destinationRoot),
    filesystem: input.filesystem,
    report: { copied: [], skipped: [] },
    transform: input.transform ?? IDENTITY_TRANSFORM,
  };
  await assertSourceDirectory(context, input.sourceRoot);
  await ensureDestinationRoot(context);
  await copyDirectory(context, input.sourceRoot, '');
  return sortedReport(context.report);
}

async function copyDirectory(
  context: CopyContext,
  sourceDirectory: string,
  sourceRelativeDirectory: string
): Promise<void> {
  await assertSourceDirectory(context, sourceDirectory);
  const entries = sortEntries(
    await readSourceEntries(context.filesystem, sourceDirectory, context.report)
  );
  await entries.reduce(
    (previous, entry) =>
      previous.then(() => {
        const sourcePath = path.join(sourceDirectory, entry.name);
        const sourceRelativePath = joinRelativePath(
          sourceRelativeDirectory,
          entry.name
        );
        return copyEntry(context, sourcePath, sourceRelativePath);
      }),
    Promise.resolve()
  );
}

function sortEntries(entries: readonly Dirent[]): Dirent[] {
  const sorted: Dirent[] = [];
  for (const entry of entries) {
    const index = sorted.findIndex(
      (candidate) => candidate.name.localeCompare(entry.name) > 0
    );
    if (index < 0) {
      sorted.push(entry);
    } else {
      sorted.splice(index, 0, entry);
    }
  }
  return sorted;
}

async function copyEntry(
  context: CopyContext,
  sourcePath: string,
  sourceRelativePath: string
): Promise<void> {
  const sourceStats = await readSourceStats(
    context.filesystem,
    sourcePath,
    context.report
  );
  const destinationRelativePath = mapDestinationPath(
    context.transform,
    sourceRelativePath,
    context.report
  );
  const destinationPath = path.join(
    context.destinationRoot,
    destinationRelativePath
  );
  if (sourceStats.isDirectory()) {
    const directoryInput: CopyDirectoryInput = {
      destinationPath,
      destinationRelativePath,
      sourcePath,
      sourceRelativePath,
    };
    await copyDirectoryEntry(
      context,
      directoryInput,
      (directory, relativeDirectory) =>
        copyDirectory(context, directory, relativeDirectory)
    );
    return;
  }
  if (sourceStats.isFile()) {
    await copyFileEntry(context, {
      destinationPath,
      destinationRelativePath,
      sourcePath,
      sourceRelativePath,
    });
    return;
  }
  throwSetupError(
    context.report,
    sourceRelativePath,
    'source entry is not a regular file or directory'
  );
}

async function assertSourceDirectory(
  context: CopyContext,
  sourcePath: string
): Promise<void> {
  const stats = await readSourceStats(
    context.filesystem,
    sourcePath,
    context.report
  );
  if (!stats.isDirectory()) {
    throwSetupError(
      context.report,
      sourcePath,
      'source scaffold root is not a directory'
    );
  }
}

function mapDestinationPath(
  transform: ScaffoldCopyTransform,
  sourcePath: string,
  report: MutableSetupReport
): string {
  try {
    return normalizeRepositoryRelativePath(
      transform.destinationPath(sourcePath)
    );
  } catch (error) {
    return throwSetupError(
      report,
      sourcePath,
      `destination path is unsafe: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

function joinRelativePath(directory: string, entry: string): string {
  return directory === '' ? entry : `${directory}/${entry}`;
}
