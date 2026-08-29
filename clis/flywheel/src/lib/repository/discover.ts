import { classifyRepositoryEntry } from './classify.js';
import type {
  RepositoryId,
  RepositoryInventory,
  RepositorySource,
} from './contract.js';
import { isRepositoryId } from './identity.js';
import { sortedCopy } from './ordering.js';

export async function discoverRepository(
  source: RepositorySource
): Promise<RepositoryInventory> {
  const sourceEntries = await source.listEntries();
  const directories = sortedCopy(
    sourceEntries
      .filter((entry) => entry.kind === 'directory')
      .map((entry) => entry.path),
    compareStrings
  );
  const repositories = discoverRepositoryIds(directories);
  const repositorySet = new Set(repositories);
  const entries = sortedCopy(
    sourceEntries
      .filter((entry) => entry.kind !== 'directory')
      .map((entry) => classifyRepositoryEntry(entry, repositorySet)),
    (left, right) => compareStrings(left.path, right.path)
  );

  return {
    directories,
    entries,
    repositories,
    state: source.state,
  };
}

function discoverRepositoryIds(
  directories: readonly string[]
): readonly RepositoryId[] {
  const repositories = directories.flatMap((directory) => {
    const segments = directory.split('/');
    if (segments.length !== 3 || segments[0] !== 'repo-specific') {
      return [];
    }
    const repositoryId = `${segments[1]}/${segments[2]}`;
    return isRepositoryId(repositoryId) ? [repositoryId] : [];
  });
  return sortedCopy([...new Set(repositories)], compareStrings);
}

function compareStrings(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}
