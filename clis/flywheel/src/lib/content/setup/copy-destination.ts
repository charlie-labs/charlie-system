import type { Stats } from 'node:fs';
import path from 'node:path';

import type { CopyContext } from './copy-context.js';
import {
  errorMessage,
  isAlreadyExists,
  isMissing,
  throwSetupError,
} from './copy-source.js';

export async function ensureDestinationRoot(
  context: CopyContext
): Promise<void> {
  const resolvedRoot = path.resolve(context.destinationRoot);
  const parsedRoot = path.parse(resolvedRoot);
  const segments = resolvedRoot
    .slice(parsedRoot.root.length)
    .split(path.sep)
    .filter((segment) => segment !== '');
  await ensureDestinationSegments(context, segments, parsedRoot.root);
}

async function ensureDestinationSegments(
  context: CopyContext,
  segments: readonly string[],
  parentPath: string
): Promise<void> {
  const [segment, ...remaining] = segments;
  if (segment === undefined) return;
  const currentPath = path.join(parentPath, segment);
  const stats = await inspectDestination(context, currentPath);
  if (stats === undefined) {
    await createDirectory(context, currentPath, currentPath);
  } else if (!stats.isDirectory()) {
    throwDestinationType(context, currentPath, stats);
  }
  await ensureDestinationSegments(context, remaining, currentPath);
}

export async function ensureDestinationDirectory(
  context: CopyContext,
  destinationPath: string,
  reportPath: string
): Promise<void> {
  const stats = await inspectDestination(context, destinationPath);
  if (stats === undefined) {
    await createDirectory(context, destinationPath, reportPath);
    return;
  }
  if (stats.isDirectory()) {
    context.report.skipped.push(reportPath);
    return;
  }
  throwDestinationType(context, reportPath, stats);
}

async function createDirectory(
  context: CopyContext,
  directoryPath: string,
  reportPath: string
): Promise<void> {
  try {
    await context.filesystem.mkdir(directoryPath);
    if (reportPath !== directoryPath || !path.isAbsolute(reportPath)) {
      context.report.copied.push(reportPath);
    }
  } catch (error) {
    if (
      isAlreadyExists(error) &&
      (await handleExistingDirectory(context, directoryPath, reportPath))
    ) {
      return;
    }
    throwSetupError(
      context.report,
      reportPath,
      `directory creation failed: ${errorMessage(error)}`,
      error
    );
  }
}

async function handleExistingDirectory(
  context: CopyContext,
  directoryPath: string,
  reportPath: string
): Promise<boolean> {
  const stats = await inspectDestination(context, directoryPath);
  if (stats === undefined) return false;
  if (!stats.isDirectory()) {
    throwDestinationType(context, reportPath, stats);
  }
  if (!path.isAbsolute(reportPath)) {
    context.report.skipped.push(reportPath);
  }
  return true;
}

async function inspectDestination(
  context: CopyContext,
  destinationPath: string
): Promise<Stats | undefined> {
  try {
    return await context.filesystem.lstat(destinationPath);
  } catch (error) {
    if (isMissing(error)) return undefined;
    return throwSetupError(
      context.report,
      destinationPath,
      `destination entry cannot be inspected: ${errorMessage(error)}`,
      error
    );
  }
}

function throwDestinationType(
  context: CopyContext,
  destinationPath: string,
  stats: Stats
): never {
  let reason: string;
  if (stats.isSymbolicLink()) {
    reason = 'destination is a symbolic link';
  } else if (stats.isDirectory()) {
    reason = 'destination is a directory but a file is required';
  } else if (stats.isFile()) {
    reason = 'destination is a file but a directory is required';
  } else {
    reason = 'destination has an unsupported filesystem type';
  }
  return throwSetupError(context.report, destinationPath, reason);
}
