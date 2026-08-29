import { compileRepository } from '../../projection/compile.js';
import { buildRepositoryIndexes } from '../../projection/indexes.js';
import type { RepositorySource } from '../../repository/contract.js';
import type { RelatedResult } from './contract.js';
import { findRelatedTargets } from './related.js';

export async function retrieveRelated(input: {
  readonly source: RepositorySource;
  readonly target: string;
}): Promise<RelatedResult> {
  const projection = await compileRepository(input.source);
  return findRelatedTargets(buildRepositoryIndexes(projection), input.target);
}
