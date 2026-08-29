import type { RepositoryPath } from '../../repository/contract.js';

export type ExactSearchPlan = Readonly<{
  readonly repositoryPath: string;
  readonly rgArgs: readonly string[];
  readonly searchPaths: readonly RepositoryPath[];
}>;
