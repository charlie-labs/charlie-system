import path from 'node:path';

import type {
  RepositoryEntry,
  RepositoryInventory,
  RepositoryPath,
} from '../repository/contract.js';
import { RepositoryPathError } from '../repository/errors.js';
import { sortedCopy } from '../repository/ordering.js';
import {
  normalizeRepositoryRelativePath,
  toRepositoryRelativePath,
} from '../repository/path.js';
import type { ValidationReport } from '../validation/contract.js';
import { validationReport } from '../validation/diagnostics.js';
import { ContentInvocationError } from './errors.js';

export type ValidationSelectionInput = Readonly<{
  readonly inventory: RepositoryInventory;
  readonly repositoryPath: string;
  readonly requestedPaths: readonly string[];
}>;

export function resolveValidationSelection({
  inventory,
  repositoryPath,
  requestedPaths,
}: ValidationSelectionInput): readonly RepositoryPath[] {
  const validationEntries = inventory.entries.filter(isValidationEntry);
  const existingPaths = new Set([
    ...inventory.directories,
    ...inventory.entries.map((entry) => entry.path),
  ]);
  const selected = requestedPaths.map((requestedPath) => {
    const repositoryRelativePath = normalizeRequestedPath(
      repositoryPath,
      requestedPath
    );
    if (!existingPaths.has(repositoryRelativePath)) {
      throw new ContentInvocationError(
        `selected repository path does not exist: ${requestedPath}`
      );
    }
    assertValidationContent(
      repositoryRelativePath,
      requestedPath,
      validationEntries
    );
    return repositoryRelativePath;
  });
  return sortedCopy([...new Set(selected)], comparePaths);
}

export function selectValidationReport(
  report: ValidationReport,
  selection: readonly RepositoryPath[]
): ValidationReport {
  if (selection.length === 0) return report;
  return validationReport(
    report.diagnostics.filter((diagnostic) =>
      selection.some((selectedPath) =>
        containsPath(selectedPath, diagnostic.path)
      )
    )
  );
}

export function selectedFileCount(
  inventory: RepositoryInventory,
  selection: readonly RepositoryPath[]
): number {
  const entries = inventory.entries.filter(isValidationEntry);
  if (selection.length === 0) return entries.length;
  return entries.filter((entry) =>
    selection.some((selectedPath) => containsPath(selectedPath, entry.path))
  ).length;
}

function normalizeRequestedPath(
  repositoryPath: string,
  requestedPath: string
): RepositoryPath {
  try {
    if (!path.isAbsolute(requestedPath)) {
      return normalizeRepositoryRelativePath(requestedPath);
    }
    return toRepositoryRelativePath(
      path.resolve(repositoryPath),
      path.resolve(requestedPath)
    );
  } catch (error) {
    if (error instanceof RepositoryPathError) {
      throw new ContentInvocationError(error.message);
    }
    throw error;
  }
}

function assertValidationContent(
  repositoryPath: RepositoryPath,
  requestedPath: string,
  entries: readonly RepositoryEntry[]
): void {
  if (!entries.some((entry) => containsPath(repositoryPath, entry.path))) {
    throw new ContentInvocationError(
      `path is not classified as validation content: ${requestedPath}`
    );
  }
}

function isValidationEntry(entry: RepositoryEntry): boolean {
  return entry.kind !== 'tooling-state';
}

function containsPath(
  selectedPath: RepositoryPath,
  candidatePath: RepositoryPath
): boolean {
  return (
    candidatePath === selectedPath ||
    candidatePath.startsWith(`${selectedPath}/`)
  );
}

function comparePaths(left: string, right: string): number {
  return left.localeCompare(right);
}
