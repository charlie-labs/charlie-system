import type { CopyContext } from './copy-context.js';
import {
  ensureDestinationDirectory,
  inspectDestination,
  throwDestinationType,
} from './copy-destination.js';
import {
  errorMessage,
  isAlreadyExists,
  readSourceBytes,
  throwSetupError,
} from './copy-source.js';

export type CopyFileInput = Readonly<{
  readonly destinationPath: string;
  readonly destinationRelativePath: string;
  readonly sourcePath: string;
  readonly sourceRelativePath: string;
}>;

export type CopyDirectoryInput = Readonly<{
  readonly destinationPath: string;
  readonly destinationRelativePath: string;
  readonly sourcePath: string;
  readonly sourceRelativePath: string;
}>;

export async function copyFileEntry(
  context: CopyContext,
  input: CopyFileInput
): Promise<void> {
  const destinationStats = await inspectDestination(
    context,
    input.destinationPath
  );
  if (destinationStats !== undefined) {
    if (destinationStats.isFile()) {
      context.report.skipped.push(input.destinationRelativePath);
      return;
    }
    throwDestinationType(
      context,
      input.destinationRelativePath,
      destinationStats
    );
  }

  const bytes = await readSourceBytes(
    context.filesystem,
    input.sourcePath,
    input.sourceRelativePath,
    context.report
  );
  try {
    await context.filesystem.writeFile(
      input.destinationPath,
      context.transform.fileBytes(input.sourceRelativePath, bytes)
    );
    context.report.copied.push(input.destinationRelativePath);
  } catch (error) {
    if (isAlreadyExists(error)) {
      await handleCreateRace(
        context,
        input.destinationPath,
        input.destinationRelativePath
      );
      return;
    }
    throwSetupError(
      context.report,
      input.destinationRelativePath,
      `file write failed: ${errorMessage(error)}`,
      error
    );
  }
}

async function handleCreateRace(
  context: CopyContext,
  destinationPath: string,
  destinationRelativePath: string
): Promise<void> {
  const destinationStats = await inspectDestination(context, destinationPath);
  if (destinationStats !== undefined && destinationStats.isFile()) {
    context.report.skipped.push(destinationRelativePath);
    return;
  }
  if (destinationStats === undefined) {
    throwSetupError(
      context.report,
      destinationRelativePath,
      'destination disappeared after creation race'
    );
  }
  throwDestinationType(context, destinationRelativePath, destinationStats);
}

export async function copyDirectoryEntry(
  context: CopyContext,
  input: CopyDirectoryInput,
  copyDirectory: (
    sourceDirectory: string,
    sourceRelativeDirectory: string
  ) => Promise<void>
): Promise<void> {
  await ensureDestinationDirectory(
    context,
    input.destinationPath,
    input.destinationRelativePath
  );
  await copyDirectory(input.sourcePath, input.sourceRelativePath);
}
