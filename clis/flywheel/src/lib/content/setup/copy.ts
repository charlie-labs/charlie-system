import path from 'node:path';

import type {
  ScaffoldCopyInput,
  ScaffoldDirectoryManifest,
  SetupCopyResult,
} from './contract.js';
import { IDENTITY_TRANSFORM, type CopyContext } from './copy-context.js';
import {
  ensureDestinationDirectory,
  ensureDestinationRoot,
} from './copy-destination.js';
import {
  copyEntry,
  mapDestinationPath,
  sortEntries,
  type CopyDirectory,
} from './copy-entry.js';
import {
  readDirectoryManifest,
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
    ...(input.directoryManifest === undefined
      ? {}
      : { directoryManifest: input.directoryManifest }),
    filesystem: input.filesystem,
    handledDirectories: new Set(),
    report: { copied: [], skipped: [] },
    ...(input.shouldCopyDirectory === undefined
      ? {}
      : { shouldCopyDirectory: input.shouldCopyDirectory }),
    ...(input.shouldCopyFile === undefined
      ? {}
      : { shouldCopyFile: input.shouldCopyFile }),
    transform: input.transform ?? IDENTITY_TRANSFORM,
  };
  await assertSourceDirectory(context, input.sourceRoot);
  await ensureDestinationRoot(context);
  await copyDirectory(context, input.sourceRoot, '');
  await copyManifestDirectories(context, input.directoryManifest);
  return sortedReport(context.report);
}

export async function copyScaffoldDirectories(
  input: ScaffoldCopyInput
): Promise<SetupCopyResult> {
  const context: CopyContext = {
    destinationRoot: path.resolve(input.destinationRoot),
    filesystem: input.filesystem,
    handledDirectories: new Set(),
    report: { copied: [], skipped: [] },
    transform: input.transform ?? IDENTITY_TRANSFORM,
  };
  await assertSourceDirectory(context, input.sourceRoot);
  const manifest = await readDirectoryManifest(
    context.filesystem,
    input.sourceRoot,
    context.report
  );
  return copyScaffoldTree({
    ...input,
    directoryManifest: manifest,
    shouldCopyDirectory: createManifestDirectoryFilter(manifest),
    shouldCopyFile: (sourceRelativePath) =>
      path.posix.basename(sourceRelativePath) === '.gitkeep',
  });
}

function createManifestDirectoryFilter(
  manifest: ScaffoldDirectoryManifest
): (sourceRelativePath: string) => boolean {
  const directories = new Set(manifest.directories);
  return (sourceRelativePath) =>
    directories.has(sourceRelativePath) ||
    manifest.directories.some((directory) =>
      directory.startsWith(`${sourceRelativePath}/`)
    );
}

async function copyManifestDirectories(
  context: CopyContext,
  manifest: ScaffoldCopyInput['directoryManifest']
): Promise<void> {
  if (manifest === undefined) return;
  await manifest.directories.reduce(
    (previous, sourcePath) =>
      previous.then(() => copyManifestDirectoryAndMark(context, sourcePath)),
    Promise.resolve()
  );
}

async function copyManifestDirectoryAndMark(
  context: CopyContext,
  sourcePath: string
): Promise<void> {
  const destinationRelativePath = mapDestinationPath(
    context.transform,
    sourcePath,
    context.report
  );
  if (context.handledDirectories.has(destinationRelativePath)) return;
  await copyManifestDirectory(context, sourcePath);
  context.handledDirectories.add(destinationRelativePath);
}

async function copyManifestDirectory(
  context: CopyContext,
  sourcePath: string
): Promise<void> {
  const destinationRelativePath = mapDestinationPath(
    context.transform,
    sourcePath,
    context.report
  );
  await ensureDestinationDirectory(
    context,
    path.join(context.destinationRoot, destinationRelativePath),
    destinationRelativePath
  );
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
  const copyDirectoryEntry: CopyDirectory = (directory, relativeDirectory) =>
    copyDirectory(context, directory, relativeDirectory);
  await entries.reduce(
    (previous, entry) =>
      previous.then(() => {
        const sourcePath = path.join(sourceDirectory, entry.name);
        const sourceRelativePath = joinRelativePath(
          sourceRelativeDirectory,
          entry.name
        );
        return copyEntry(context, {
          copyDirectory: copyDirectoryEntry,
          sourcePath,
          sourceRelativePath,
        });
      }),
    Promise.resolve()
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

function joinRelativePath(directory: string, entry: string): string {
  return directory === '' ? entry : `${directory}/${entry}`;
}
