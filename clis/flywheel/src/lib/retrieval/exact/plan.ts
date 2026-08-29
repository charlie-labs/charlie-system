import type {
  RepositoryInventory,
  RepositorySelection,
} from '../../repository/contract.js';
import { resolveSelectedRepositoryIds } from '../../repository/selection.js';
import { prepareRipgrepArguments, type ExactSearchScope } from './arguments.js';
import type { ExactSearchPlan } from './contract.js';

const CUSTOMER_WIDE_DIRECTORIES = [
  'customer-wide/catalog',
  'customer-wide/docs',
  'customer-wide/.agents/daemons',
  'customer-wide/.agents/skills',
] as const;

const REPOSITORY_DIRECTORIES = [
  'catalog',
  'docs',
  '.agents/daemons',
  '.agents/skills',
] as const;

export function planExactSearch(
  inventory: RepositoryInventory,
  selection: RepositorySelection,
  rgArgs: readonly string[]
): ExactSearchPlan {
  const scope = createExactSearchScope(inventory, selection);
  return {
    repositoryPath: inventory.state.repositoryPath,
    rgArgs: prepareRipgrepArguments(rgArgs, scope),
    searchPaths: scope.searchPaths,
  };
}

function createExactSearchScope(
  inventory: RepositoryInventory,
  selection: RepositorySelection
): ExactSearchScope {
  const existingDirectories = new Set(inventory.directories);
  const selectedRepositories = resolveSelectedRepositoryIds(
    selection,
    inventory
  );
  const directories = [
    ...CUSTOMER_WIDE_DIRECTORIES,
    ...selectedRepositories.flatMap((repositoryId) =>
      REPOSITORY_DIRECTORIES.map(
        (suffix) => `repo-specific/${repositoryId}/${suffix}`
      )
    ),
  ].filter((directory) => existingDirectories.has(directory));
  const files = inventory.entries.flatMap((entry) =>
    entry.kind === 'artifact' && entry.artifactKind === 'role'
      ? [entry.path]
      : []
  );
  const symbolicLinks = inventory.entries.flatMap((entry) =>
    entry.kind === 'unsupported' && entry.reason === 'symbolic-link'
      ? [entry.path]
      : []
  );
  return {
    directories,
    files,
    searchPaths: [...files, ...directories],
    symbolicLinks,
  };
}
