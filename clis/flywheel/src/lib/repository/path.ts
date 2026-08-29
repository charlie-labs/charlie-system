import path from 'node:path';

import type { RepositoryPath } from './contract.js';
import { RepositoryPathError } from './errors.js';

export const DEFAULT_REPOSITORY_PATH = '/home/user/.charlie/customer-knowledge';

export type RepositoryPathOptions = Readonly<{
  readonly cwd: string;
  readonly explicitPath?: string;
}>;

export function resolveRepositoryPath({
  cwd,
  explicitPath,
}: RepositoryPathOptions): string {
  const trimmedPath = explicitPath?.trim();
  const requestedPath =
    trimmedPath === undefined || trimmedPath === ''
      ? DEFAULT_REPOSITORY_PATH
      : trimmedPath;

  return path.normalize(
    path.isAbsolute(requestedPath)
      ? requestedPath
      : path.resolve(cwd, requestedPath)
  );
}

export function normalizeRepositoryRelativePath(
  candidate: string
): RepositoryPath {
  if (
    candidate.trim() === '' ||
    candidate.includes('\\') ||
    candidate.includes('\0') ||
    path.posix.isAbsolute(candidate)
  ) {
    throw new RepositoryPathError(`invalid repository path: ${candidate}`);
  }

  const normalized = path.posix.normalize(candidate);
  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    throw new RepositoryPathError(
      `repository path escapes the selected repository: ${candidate}`
    );
  }
  return normalized;
}

export function resolveRepositoryEntryPath(
  repositoryPath: string,
  relativePath: RepositoryPath
): string {
  const normalized = normalizeRepositoryRelativePath(relativePath);
  const resolved = path.resolve(repositoryPath, normalized);
  if (!isWithinRepository(repositoryPath, resolved)) {
    throw new RepositoryPathError(
      `repository path escapes the selected repository: ${relativePath}`
    );
  }
  return resolved;
}

export function toRepositoryRelativePath(
  repositoryPath: string,
  absolutePath: string
): RepositoryPath {
  if (!isWithinRepository(repositoryPath, absolutePath)) {
    throw new RepositoryPathError(
      `path is outside the selected repository: ${absolutePath}`
    );
  }
  return normalizeRepositoryRelativePath(
    path.relative(repositoryPath, absolutePath).split(path.sep).join('/')
  );
}

function isWithinRepository(
  repositoryPath: string,
  candidatePath: string
): boolean {
  const relative = path.relative(repositoryPath, candidatePath);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}
