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
import {
  ensureDestinationDirectory,
  ensureDestinationRoot,
} from './copy-destination.js';
import {
  readDirectoryManifest,
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
  const manifest = await readDirectoryManifest(
    context.filesystem,
    input.sourceRoot,
    context.report
  );
  await ensureDestinationRoot(context);
  await copyManifestDirectories(context, manifest.directories);
  return sortedReport(context.report);
}

async function copyManifestDirectories(
  context: CopyContext,
  directories: readonly string[]
): Promise<void> {
  const destinationPaths = new Set<string>();
  await directories.reduce(
    (previous, sourcePath) =>
      previous.then(() =>
        copyManifestDirectory(context, sourcePath, destinationPaths)
      ),
    Promise.resolve()
  );
}

async function copyManifestDirectory(
  context: CopyContext,
  sourcePath: string,
  destinationPaths: Set<string>
): Promise<void> {
  const destinationRelativePath = mapDestinationPath(
    context.transform,
    sourcePath,
    context.report
  );
  if (destinationPaths.has(destinationRelativePath)) return;
  destinationPaths.add(destinationRelativePath);
  await ensureDestinationDirectory(
    context,
    path.join(context.destinationRoot, destinationRelativePath),
    destinationRelativePath
  );
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
