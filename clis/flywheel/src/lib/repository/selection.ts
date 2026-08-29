import type {
  RepositoryId,
  RepositoryInventory,
  RepositorySelection,
} from './contract.js';
import { RepositorySelectionError } from './errors.js';
import { normalizeRepositoryId } from './identity.js';
import { sortedCopy } from './ordering.js';

export type RepositorySelectionOptions = Readonly<{
  readonly customerWideOnly: boolean;
  readonly repositoryIds: readonly string[];
}>;

export function createRepositorySelection({
  customerWideOnly,
  repositoryIds,
}: RepositorySelectionOptions): RepositorySelection {
  if (customerWideOnly && repositoryIds.length > 0) {
    throw new RepositorySelectionError(
      '--customer-wide-only cannot be combined with --repo'
    );
  }
  if (customerWideOnly) {
    return { kind: 'customer-wide-only' };
  }
  if (repositoryIds.length === 0) {
    return { kind: 'customer-wide-and-all-repositories' };
  }
  return {
    kind: 'customer-wide-and-repositories',
    repositories: normalizedRepositoryIds(repositoryIds),
  };
}

export function resolveSelectedRepositoryIds(
  selection: RepositorySelection,
  inventory: RepositoryInventory
): readonly RepositoryId[] {
  if (selection.kind === 'customer-wide-only') {
    return [];
  }
  if (selection.kind === 'customer-wide-and-all-repositories') {
    return inventory.repositories;
  }

  const known = new Set(inventory.repositories);
  for (const repositoryId of selection.repositories) {
    if (!known.has(repositoryId)) {
      throw new RepositorySelectionError(
        `selected repository does not exist: ${repositoryId}`
      );
    }
  }
  return selection.repositories;
}

function normalizedRepositoryIds(
  repositoryIds: readonly string[]
): readonly RepositoryId[] {
  return sortedCopy(
    [...new Set(repositoryIds.map((value) => normalizeRepositoryId(value)))],
    compareStrings
  );
}

function compareStrings(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}
