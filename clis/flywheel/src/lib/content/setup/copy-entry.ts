import type { Dirent } from 'node:fs';
import path from 'node:path';

import { normalizeRepositoryRelativePath } from '../../repository/path.js';
import type { CopyContext, MutableSetupReport } from './copy-context.js';
import {
  copyDirectoryEntry,
  copyFileEntry,
  type CopyDirectoryInput,
} from './copy-file.js';
import { readSourceStats, throwSetupError } from './copy-source.js';

export type CopyDirectory = (
  sourceDirectory: string,
  sourceRelativeDirectory: string
) => Promise<void>;

type CopyEntryInput = Readonly<{
  readonly copyDirectory: CopyDirectory;
  readonly sourcePath: string;
  readonly sourceRelativePath: string;
}>;

export async function copyEntry(
  context: CopyContext,
  input: CopyEntryInput
): Promise<void> {
  const sourceStats = await readSourceStats(
    context.filesystem,
    input.sourcePath,
    context.report
  );
  if (input.sourceRelativePath === context.directoryManifest?.sourcePath) {
    if (!sourceStats.isFile()) {
      throwSetupError(
        context.report,
        input.sourceRelativePath,
        'source entry is not a regular file or directory'
      );
    }
    return;
  }
  const destinationRelativePath = mapDestinationPath(
    context.transform,
    input.sourceRelativePath,
    context.report
  );
  const destinationPath = path.join(
    context.destinationRoot,
    destinationRelativePath
  );
  if (sourceStats.isDirectory()) {
    await copySourceDirectoryEntry(context, {
      copyDirectory: input.copyDirectory,
      destinationPath,
      destinationRelativePath,
      sourcePath: input.sourcePath,
      sourceRelativePath: input.sourceRelativePath,
    });
    return;
  }
  if (sourceStats.isFile()) {
    await copySourceFileEntry(context, {
      destinationPath,
      destinationRelativePath,
      sourcePath: input.sourcePath,
      sourceRelativePath: input.sourceRelativePath,
    });
    return;
  }
  throwSetupError(
    context.report,
    input.sourceRelativePath,
    'source entry is not a regular file or directory'
  );
}

type CopySourceDirectoryInput = Readonly<{
  readonly copyDirectory: CopyDirectory;
  readonly destinationPath: string;
  readonly destinationRelativePath: string;
  readonly sourcePath: string;
  readonly sourceRelativePath: string;
}>;

async function copySourceDirectoryEntry(
  context: CopyContext,
  input: CopySourceDirectoryInput
): Promise<void> {
  if (
    context.shouldCopyDirectory !== undefined &&
    !context.shouldCopyDirectory(input.sourceRelativePath)
  ) {
    return;
  }
  const directoryInput: CopyDirectoryInput = {
    destinationPath: input.destinationPath,
    destinationRelativePath: input.destinationRelativePath,
    sourcePath: input.sourcePath,
    sourceRelativePath: input.sourceRelativePath,
  };
  await copyDirectoryEntry(context, directoryInput, input.copyDirectory);
  context.handledDirectories.add(input.destinationRelativePath);
}

type CopySourceFileInput = Readonly<{
  readonly destinationPath: string;
  readonly destinationRelativePath: string;
  readonly sourcePath: string;
  readonly sourceRelativePath: string;
}>;

async function copySourceFileEntry(
  context: CopyContext,
  input: CopySourceFileInput
): Promise<void> {
  if (
    context.shouldCopyFile !== undefined &&
    !context.shouldCopyFile(input.sourceRelativePath)
  ) {
    return;
  }
  await copyFileEntry(context, input);
}

export function mapDestinationPath(
  transform: CopyContext['transform'],
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

export function sortEntries(entries: readonly Dirent[]): Dirent[] {
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
