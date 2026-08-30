import path from 'node:path';

import type { RepositoryPath } from './contract.js';
import { RepositoryPathError } from './errors.js';

export const DEFAULT_REPOSITORY_PATH = '/home/user/.charlie/flywheel';

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
    throw new RepositoryPathError(
      `invalid Flywheel repository path: ${candidate}`
    );
  }

  const normalized = path.posix.normalize(candidate);
  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    throw new RepositoryPathError(
      `Flywheel repository path escapes the selected Flywheel repository: ${candidate}`
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
      `Flywheel repository path escapes the selected Flywheel repository: ${relativePath}`
    );
  }
  return resolved;
}

export function toRepositoryRelativePath(
  repositoryPath: string,
  absolutePath: string,
  source: 'validated-input' | 'filesystem-entry' = 'validated-input'
): RepositoryPath {
  if (!isWithinRepository(repositoryPath, absolutePath)) {
    throw new RepositoryPathError(
      `path is outside the selected Flywheel repository: ${absolutePath}`
    );
  }
  const relativePath = path.relative(repositoryPath, absolutePath);
  if (source === 'filesystem-entry') {
    if (relativePath === '') {
      throw new RepositoryPathError(
        `path does not identify a Flywheel repository entry: ${absolutePath}`
      );
    }
    return relativePath.split(path.sep).join('/');
  }
  return normalizeRepositoryRelativePath(
    relativePath.split(path.sep).join('/')
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
