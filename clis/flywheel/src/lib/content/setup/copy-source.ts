import type { Stats } from 'node:fs';
import path from 'node:path';

import type { AsyncFileSystem } from '../../runtime/deps.js';
import { ContentSetupError } from '../setup-error.js';
import type { ScaffoldDirectoryManifest } from './contract.js';
import type { MutableSetupReport } from './copy-context.js';

const DIRECTORY_MANIFEST_PATH = 'DIRECTORIES';

export async function readDirectoryManifest(
  filesystem: AsyncFileSystem,
  sourceRoot: string,
  report: MutableSetupReport
): Promise<ScaffoldDirectoryManifest> {
  const sourcePath = path.join(sourceRoot, DIRECTORY_MANIFEST_PATH);
  let sourceStats: Stats;
  try {
    sourceStats = await filesystem.lstat(sourcePath);
  } catch (error) {
    return throwSetupError(
      report,
      DIRECTORY_MANIFEST_PATH,
      `source directory manifest cannot be inspected: ${errorMessage(error)}`,
      error
    );
  }
  if (!sourceStats.isFile()) {
    return throwSetupError(
      report,
      DIRECTORY_MANIFEST_PATH,
      'source directory manifest is not a regular file'
    );
  }
  let contents: string;
  try {
    contents = await filesystem.readFile(sourcePath);
  } catch (error) {
    return throwSetupError(
      report,
      DIRECTORY_MANIFEST_PATH,
      `source directory manifest cannot be read: ${errorMessage(error)}`,
      error
    );
  }
  const directories = contents
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  if (directories.length === 0) {
    return throwSetupError(
      report,
      DIRECTORY_MANIFEST_PATH,
      'source directory manifest is empty'
    );
  }
  return { directories, sourcePath: DIRECTORY_MANIFEST_PATH };
}

export function throwSetupError(
  report: MutableSetupReport,
  failedPath: string,
  reason: string,
  cause?: unknown
): never {
  const options = cause === undefined ? undefined : { cause };
  throw new ContentSetupError(
    failedPath,
    reason,
    sortedReport(report),
    options
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error
    ? error.code
    : undefined;
}

export function isAlreadyExists(error: unknown): boolean {
  return errorCode(error) === 'EEXIST';
}

export function isMissing(error: unknown): boolean {
  return errorCode(error) === 'ENOENT';
}

export function sortedReport(report: MutableSetupReport): Readonly<{
  readonly copied: readonly string[];
  readonly skipped: readonly string[];
}> {
  return {
    copied: sortedPaths(report.copied),
    skipped: sortedPaths(report.skipped),
  };
}

function sortedPaths(paths: readonly string[]): string[] {
  const sorted: string[] = [];
  for (const candidatePath of paths) {
    const index = sorted.findIndex(
      (candidate) => candidate.localeCompare(candidatePath) > 0
    );
    if (index < 0) {
      sorted.push(candidatePath);
    } else {
      sorted.splice(index, 0, candidatePath);
    }
  }
  return sorted;
}
