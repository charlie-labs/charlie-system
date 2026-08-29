import path from 'node:path';

import type {
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
  const availablePaths = new Set([
    ...inventory.directories,
    ...inventory.entries.map((entry) => entry.path),
  ]);
  const selected = requestedPaths.map((requestedPath) => {
    const repositoryRelativePath = normalizeRequestedPath(
      repositoryPath,
      requestedPath
    );
    assertAdmittedPath(repositoryRelativePath, requestedPath, inventory);
    if (!availablePaths.has(repositoryRelativePath)) {
      throw new ContentInvocationError(
        `selected repository path does not exist: ${requestedPath}`
      );
    }
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
  if (selection.length === 0) return inventory.entries.length;
  return inventory.entries.filter((entry) =>
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

function assertAdmittedPath(
  repositoryPath: RepositoryPath,
  requestedPath: string,
  inventory: RepositoryInventory
): void {
  const segments = repositoryPath.split('/');
  const root = segments[0];
  const admitted =
    root === 'core' ||
    root === 'customer-wide' ||
    root === 'roles' ||
    root === '.flywheel' ||
    isRegisteredRepositoryPath(segments, inventory);
  if (!admitted) {
    throw new ContentInvocationError(
      `path is outside admitted Flywheel content roots: ${requestedPath}`
    );
  }
}

function isRegisteredRepositoryPath(
  segments: readonly string[],
  inventory: RepositoryInventory
): boolean {
  if (segments[0] !== 'repo-specific' || segments.length < 3) return false;
  return inventory.repositories.includes(`${segments[1]}/${segments[2]}`);
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
