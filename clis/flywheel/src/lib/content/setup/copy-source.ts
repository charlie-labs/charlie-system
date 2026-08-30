import type { Dirent, Stats } from 'node:fs';

import type { AsyncFileSystem } from '../../runtime/deps.js';
import { ContentSetupError } from '../setup-error.js';
import type { MutableSetupReport } from './copy-context.js';

export async function readSourceEntries(
  filesystem: AsyncFileSystem,
  sourcePath: string,
  report: MutableSetupReport
): Promise<Dirent[]> {
  try {
    return await filesystem.readdir(sourcePath);
  } catch (error) {
    return throwSetupError(
      report,
      sourcePath,
      `source directory cannot be read: ${errorMessage(error)}`,
      error
    );
  }
}

export async function readSourceStats(
  filesystem: AsyncFileSystem,
  sourcePath: string,
  report: MutableSetupReport
): Promise<Stats> {
  try {
    return await filesystem.lstat(sourcePath);
  } catch (error) {
    return throwSetupError(
      report,
      sourcePath,
      `source entry cannot be inspected: ${errorMessage(error)}`,
      error
    );
  }
}

export async function readSourceBytes(
  filesystem: AsyncFileSystem,
  sourcePath: string,
  reportPath: string,
  report: MutableSetupReport
): Promise<Uint8Array> {
  try {
    return await filesystem.readFileBytes(sourcePath);
  } catch (error) {
    return throwSetupError(
      report,
      reportPath,
      `source file cannot be read: ${errorMessage(error)}`,
      error
    );
  }
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
  for (const path of paths) {
    const index = sorted.findIndex(
      (candidate) => candidate.localeCompare(path) > 0
    );
    if (index < 0) {
      sorted.push(path);
    } else {
      sorted.splice(index, 0, path);
    }
  }
  return sorted;
}
