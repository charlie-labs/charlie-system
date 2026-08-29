import type { RepositorySource } from '../../repository/contract.js';
import {
  RepositoryIdentityError,
  RepositorySelectionError,
  RepositorySourceError,
} from '../../repository/errors.js';
import { compileAndAssessRepository } from '../../validation/assess.js';
import type {
  KnowledgeContentType,
  RetrievalScope,
} from '../corpus/contract.js';
import { createRetrievalScope } from '../corpus/eligibility.js';
import type { RetrievalCandidateSource } from './candidate-source.js';
import type { SearchOutcome } from './contract.js';
import {
  createSearchContext,
  searchAssessedRepository,
  validateSearchRequest,
} from './search.js';

export type KnowledgeSearchInput = Readonly<{
  readonly artifactLimit: number;
  readonly candidateSource: RetrievalCandidateSource;
  readonly contentTypes: readonly KnowledgeContentType[];
  readonly customerWideOnly: boolean;
  readonly includeNonActive: boolean;
  readonly passageLimitPerArtifact: number;
  readonly query: string;
  readonly repositoryIds: readonly string[];
  readonly source: RepositorySource;
}>;

export async function retrieveKnowledge(
  input: KnowledgeSearchInput
): Promise<SearchOutcome> {
  const requestProblem = validateSearchRequest(input);
  if (requestProblem !== undefined) {
    return { kind: 'invalid-selection', message: requestProblem };
  }
  const scope = retrievalScope(input);
  if ('kind' in scope) return scope;
  try {
    const repository = await compileAndAssessRepository(input.source);
    return await searchAssessedRepository({
      artifactLimit: input.artifactLimit,
      candidateSource: input.candidateSource,
      passageLimitPerArtifact: input.passageLimitPerArtifact,
      query: input.query,
      repository,
      scope,
    });
  } catch (error) {
    if (error instanceof RepositorySourceError) {
      return {
        context: createSearchContext(input.query.trim(), scope),
        diagnostics: [],
        kind: 'unavailable',
        message: error.message,
        reason: 'repository-unavailable',
      };
    }
    throw error;
  }
}

function retrievalScope(
  input: KnowledgeSearchInput
):
  | RetrievalScope
  | Extract<SearchOutcome, { readonly kind: 'invalid-selection' }> {
  try {
    return createRetrievalScope({
      contentTypes: input.contentTypes,
      customerWideOnly: input.customerWideOnly,
      includeNonActive: input.includeNonActive,
      repositoryIds: input.repositoryIds,
    });
  } catch (error) {
    if (
      error instanceof RepositoryIdentityError ||
      error instanceof RepositorySelectionError
    ) {
      return { kind: 'invalid-selection', message: error.message };
    }
    throw error;
  }
}
