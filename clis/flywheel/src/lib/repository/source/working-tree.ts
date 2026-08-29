import type { Dirent } from 'node:fs';
import path from 'node:path';

import type { AsyncFileSystem } from '../../runtime/deps.js';
import type {
  FileReadResult,
  RepositoryPath,
  RepositorySource,
  RepositorySourceEntry,
  RepositoryState,
} from '../contract.js';
import { RepositorySourceError } from '../errors.js';
import { sortedCopy } from '../ordering.js';
import {
  resolveRepositoryEntryPath,
  toRepositoryRelativePath,
} from '../path.js';

export type WorkingTreeSourceOptions = Readonly<{
  readonly filesystem: AsyncFileSystem;
  readonly repositoryPath: string;
}>;

export function createWorkingTreeSource({
  filesystem,
  repositoryPath,
}: WorkingTreeSourceOptions): RepositorySource {
  const normalizedRoot = path.resolve(repositoryPath);
  const state: RepositoryState = {
    kind: 'working-tree',
    repositoryPath: normalizedRoot,
  };
  return {
    state,
    listEntries: () => listWorkingTreeEntries(filesystem, normalizedRoot),
    readFiles: (paths) =>
      readWorkingTreeFiles(filesystem, normalizedRoot, paths),
  };
}

async function listWorkingTreeEntries(
  filesystem: AsyncFileSystem,
  repositoryPath: string
): Promise<readonly RepositorySourceEntry[]> {
  await assertRepositoryDirectory(filesystem, repositoryPath);
  const entries = await collectDirectory(
    filesystem,
    repositoryPath,
    repositoryPath,
    true
  );
  return sortedCopy(entries, (left, right) =>
    comparePaths(left.path, right.path)
  );
}

async function collectDirectory(
  filesystem: AsyncFileSystem,
  repositoryPath: string,
  directoryPath: string,
  isRoot: boolean
): Promise<readonly RepositorySourceEntry[]> {
  let entries;
  try {
    entries = await filesystem.readdir(directoryPath);
  } catch (error) {
    throw new RepositorySourceError(
      `cannot list repository directory: ${directoryPath}`,
      { cause: error }
    );
  }

  const collected = await Promise.all(
    entries
      .filter((entry) => !isRoot || entry.name !== '.git')
      .map((entry) =>
        collectEntry(filesystem, repositoryPath, directoryPath, entry)
      )
  );
  return collected.flat();
}

async function collectEntry(
  filesystem: AsyncFileSystem,
  repositoryPath: string,
  directoryPath: string,
  entry: Dirent
): Promise<readonly RepositorySourceEntry[]> {
  const absolutePath = path.join(directoryPath, entry.name);
  const relativePath = toRepositoryRelativePath(
    repositoryPath,
    absolutePath,
    'filesystem-entry'
  );
  const sourceEntry = {
    kind: sourceEntryKind(entry),
    path: relativePath,
  } satisfies RepositorySourceEntry;
  if (!entry.isDirectory()) {
    return [sourceEntry];
  }
  const descendants = await collectDirectory(
    filesystem,
    repositoryPath,
    absolutePath,
    false
  );
  return [sourceEntry, ...descendants];
}

function sourceEntryKind(entry: Dirent): RepositorySourceEntry['kind'] {
  if (entry.isDirectory()) {
    return 'directory';
  }
  if (entry.isFile()) {
    return 'file';
  }
  if (entry.isSymbolicLink()) {
    return 'symbolic-link';
  }
  return 'other';
}

async function readWorkingTreeFiles(
  filesystem: AsyncFileSystem,
  repositoryPath: string,
  paths: readonly RepositoryPath[]
): Promise<readonly FileReadResult[]> {
  return Promise.all(
    paths.map((repositoryFilePath) =>
      readWorkingTreeFile(filesystem, repositoryPath, repositoryFilePath)
    )
  );
}

async function readWorkingTreeFile(
  filesystem: AsyncFileSystem,
  repositoryPath: string,
  repositoryFilePath: RepositoryPath
): Promise<FileReadResult> {
  const absolutePath = resolveRepositoryEntryPath(
    repositoryPath,
    repositoryFilePath
  );
  try {
    await assertDirectoryAncestors(
      filesystem,
      repositoryPath,
      repositoryFilePath
    );
    const stats = await filesystem.lstat(absolutePath);
    if (!stats.isFile()) {
      throw new RepositorySourceError(
        `repository path is not a regular file: ${repositoryFilePath}`
      );
    }
    return {
      bytes: await filesystem.readFileBytes(absolutePath),
      kind: 'read',
      path: repositoryFilePath,
    };
  } catch (error) {
    if (isMissing(error)) {
      return { kind: 'missing', path: repositoryFilePath };
    }
    if (error instanceof RepositorySourceError) {
      throw error;
    }
    throw new RepositorySourceError(
      `cannot read repository file: ${repositoryFilePath}`,
      { cause: error }
    );
  }
}

async function assertDirectoryAncestors(
  filesystem: AsyncFileSystem,
  repositoryPath: string,
  repositoryFilePath: RepositoryPath
): Promise<void> {
  const segments = repositoryFilePath.split('/');
  const ancestors = segments
    .slice(0, -1)
    .map((_, index) =>
      path.join(repositoryPath, ...segments.slice(0, index + 1))
    );
  const stats = await Promise.all(
    ancestors.map((ancestor) => filesystem.lstat(ancestor))
  );
  if (stats.some((item) => !item.isDirectory())) {
    throw new RepositorySourceError(
      `repository path traverses a non-directory entry: ${repositoryFilePath}`
    );
  }
}

async function assertRepositoryDirectory(
  filesystem: AsyncFileSystem,
  repositoryPath: string
): Promise<void> {
  try {
    const stats = await filesystem.stat(repositoryPath);
    if (!stats.isDirectory()) {
      throw new RepositorySourceError(
        `selected repository path is not a directory: ${repositoryPath}`
      );
    }
  } catch (error) {
    if (error instanceof RepositorySourceError) {
      throw error;
    }
    throw new RepositorySourceError(
      `cannot read selected repository: ${repositoryPath}`,
      { cause: error }
    );
  }
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function comparePaths(left: RepositoryPath, right: RepositoryPath): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}
