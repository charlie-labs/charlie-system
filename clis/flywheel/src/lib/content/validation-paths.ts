import path from 'node:path';

import { isRepositoryId } from '../repository/identity.js';
import type { AsyncFileSystem } from '../runtime/deps.js';
import { ContentInvocationError, ContentOperationalError } from './errors.js';
import { sortedCopy } from './ordering.js';

export async function discoverValidationRoots(
  filesystem: AsyncFileSystem,
  repositoryPath: string
): Promise<readonly string[]> {
  await assertRepositoryDirectory(filesystem, repositoryPath);
  const repositoryIds = await discoverRepositoryIds(filesystem, repositoryPath);
  const relativeRoots = [
    'roles',
    'customer-wide',
    ...repositoryIds.map((repositoryId) => `repo-specific/${repositoryId}`),
  ];
  return existingRoots(filesystem, repositoryPath, relativeRoots);
}

export function resolveValidationPath(
  repositoryPath: string,
  requestedPath: string
): string {
  if (requestedPath.trim() === '' || requestedPath.includes('\\')) {
    throw new ContentInvocationError(
      `invalid repository path: ${requestedPath}`
    );
  }
  const candidate = path.isAbsolute(requestedPath)
    ? path.resolve(requestedPath)
    : path.resolve(repositoryPath, requestedPath);
  if (!isWithin(repositoryPath, candidate)) {
    throw new ContentInvocationError(
      `repository path escapes the selected repository: ${requestedPath}`
    );
  }
  const relativePath = toRepositoryRelative(repositoryPath, candidate);
  if (!isValidationPathInScope(relativePath)) {
    throw new ContentInvocationError(
      `path is outside admitted Flywheel content roots: ${requestedPath}`
    );
  }
  return candidate;
}

export function toRepositoryRelative(
  repositoryPath: string,
  filePath: string
): string {
  return path.relative(repositoryPath, filePath).split(path.sep).join('/');
}

async function discoverRepositoryIds(
  filesystem: AsyncFileSystem,
  repositoryPath: string
): Promise<readonly string[]> {
  const repoSpecificPath = path.join(repositoryPath, 'repo-specific');
  let owners;
  try {
    owners = await filesystem.readdir(repoSpecificPath);
  } catch (error) {
    if (isMissing(error)) {
      return [];
    }
    throw new ContentOperationalError(
      `cannot discover repo-specific content: ${repoSpecificPath}`,
      { cause: error }
    );
  }
  const ownerResults = await Promise.all(
    owners
      .filter((owner) => owner.isDirectory())
      .map((owner) =>
        discoverOwnerRepositories(filesystem, repoSpecificPath, owner.name)
      )
  );
  return sortedCopy(ownerResults.flat(), (left, right) =>
    left.localeCompare(right)
  );
}

async function discoverOwnerRepositories(
  filesystem: AsyncFileSystem,
  repoSpecificPath: string,
  ownerName: string
): Promise<readonly string[]> {
  let names;
  try {
    names = await filesystem.readdir(path.join(repoSpecificPath, ownerName));
  } catch (error) {
    throw new ContentOperationalError(
      `cannot discover repo-specific content: ${ownerName}`,
      { cause: error }
    );
  }
  return names
    .filter((name) => name.isDirectory())
    .map((name) => `${ownerName}/${name.name}`)
    .filter((repositoryId) => isRepositoryId(repositoryId));
}

async function existingRoots(
  filesystem: AsyncFileSystem,
  repositoryPath: string,
  relativeRoots: readonly string[]
): Promise<readonly string[]> {
  const roots = await Promise.all(
    relativeRoots.map((relativeRoot) =>
      existingDirectory(filesystem, repositoryPath, relativeRoot)
    )
  );
  return sortedCopy(
    roots.filter((root): root is string => root !== undefined),
    (left, right) => left.localeCompare(right)
  );
}

async function existingDirectory(
  filesystem: AsyncFileSystem,
  repositoryPath: string,
  relativeRoot: string
): Promise<string | undefined> {
  const absoluteRoot = path.join(repositoryPath, relativeRoot);
  try {
    const rootStats = await filesystem.lstat(absoluteRoot);
    return rootStats.isDirectory() ? absoluteRoot : undefined;
  } catch (error) {
    if (isMissing(error)) {
      return undefined;
    }
    throw new ContentOperationalError(
      `cannot read content root: ${relativeRoot}`,
      { cause: error }
    );
  }
}

async function assertRepositoryDirectory(
  filesystem: AsyncFileSystem,
  repositoryPath: string
): Promise<void> {
  try {
    const repositoryStats = await filesystem.stat(repositoryPath);
    if (!repositoryStats.isDirectory()) {
      throw new ContentOperationalError(
        `selected repository path is not a directory: ${repositoryPath}`
      );
    }
  } catch (error) {
    if (error instanceof ContentOperationalError) {
      throw error;
    }
    throw new ContentOperationalError(
      `cannot read selected repository: ${repositoryPath}`,
      { cause: error }
    );
  }
}

function isValidationPathInScope(relativePath: string): boolean {
  const segments = relativePath.split('/');
  if (segments[0] === 'roles' || segments[0] === 'customer-wide') {
    return true;
  }
  return (
    segments[0] === 'repo-specific' &&
    segments.length > 2 &&
    isRepositoryId(`${segments[1]}/${segments[2]}`)
  );
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
