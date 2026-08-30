import { RepositorySelectionError } from '../../repository/errors.js';
import { retrievalAssessmentState } from '../assessment/state.js';
import type {
  EligibleKnowledgeCorpus,
  KnowledgeSourceProjection,
  RetrievalScope,
} from '../corpus/contract.js';
import {
  materializeEligibleKnowledge,
  selectEligibleKnowledge,
} from '../corpus/eligibility.js';
import { projectKnowledge } from '../corpus/project.js';
import type { CandidateSourceResult } from './candidate-source.js';
import type {
  AssessedSearchInput,
  SearchContext,
  SearchNotice,
  SearchOutcome,
} from './contract.js';
import { groupCandidates, type GroupingResult } from './group.js';

export async function searchAssessedRepository(
  input: AssessedSearchInput
): Promise<SearchOutcome> {
  const requestProblem = validateSearchRequest(input);
  if (requestProblem !== undefined) {
    return { kind: 'invalid-selection', message: requestProblem };
  }
  const query = input.query.trim();
  const context = createSearchContext(query, input.scope);
  const assessment = retrievalAssessmentState(input.repository);
  if (assessment.kind !== 'valid') {
    return unavailableAssessment(assessment, context);
  }
  const source = projectKnowledge(input.repository);
  let corpus: EligibleKnowledgeCorpus;
  try {
    corpus = selectEligibleKnowledge(
      source,
      input.repository.projection.inventory,
      input.scope
    );
  } catch (error) {
    if (error instanceof RepositorySelectionError) {
      return { kind: 'invalid-selection', message: error.message };
    }
    throw error;
  }
  const notices = inactiveNotices(source, corpus, input);
  if (corpus.artifactIds.length === 0) {
    return { context, kind: 'no-eligible-content', notices };
  }
  const candidateResult = await findCandidates(input, query, source, corpus);
  if (candidateResult.kind !== 'candidates') {
    return candidateFailure(candidateResult, context);
  }
  const grouped = groupCandidates({
    artifactLimit: input.artifactLimit,
    candidates: candidateResult.candidates,
    corpus,
    passageLimitPerArtifact: input.passageLimitPerArtifact,
    source,
  });
  return groupedOutcome(grouped, context, notices);
}

function groupedOutcome(
  grouped: GroupingResult,
  context: SearchContext,
  notices: readonly SearchNotice[]
): SearchOutcome {
  if (grouped.kind === 'invalid-candidates') {
    return {
      context,
      diagnostics: [],
      kind: 'unavailable',
      message: grouped.message,
      reason: 'candidate-source-invalid',
    };
  }
  const combinedNotices = [...notices, ...grouped.notices];
  return grouped.results.length === 0
    ? { context, kind: 'no-useful-result', notices: combinedNotices }
    : {
        context,
        kind: 'results',
        notices: combinedNotices,
        results: grouped.results,
      };
}

export function validateSearchRequest(
  input: Pick<
    AssessedSearchInput,
    'artifactLimit' | 'passageLimitPerArtifact' | 'query'
  >
): string | undefined {
  if (input.query.trim() === '') return 'search query must not be empty';
  if (!isPositiveInteger(input.artifactLimit)) {
    return 'artifact result limit must be a positive integer';
  }
  return isPositiveInteger(input.passageLimitPerArtifact)
    ? undefined
    : 'passage result limit must be a positive integer';
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export function createSearchContext(
  query: string,
  scope: RetrievalScope
): SearchContext {
  return {
    contentTypes: scope.contentTypes,
    lifecycleSelection: scope.lifecycle,
    query,
    repositorySelection: scope.repositories,
  };
}

function unavailableAssessment(
  assessment: Exclude<
    ReturnType<typeof retrievalAssessmentState>,
    { readonly kind: 'valid' }
  >,
  context: SearchContext
): SearchOutcome {
  const incomplete = assessment.kind === 'incomplete';
  return {
    context,
    diagnostics: assessment.repository.validation.diagnostics,
    kind: 'unavailable',
    message: incomplete
      ? 'Flywheel repository projection is incomplete'
      : 'Flywheel repository assessment is invalid',
    reason: incomplete ? 'projection-incomplete' : 'repository-invalid',
  };
}

async function findCandidates(
  input: AssessedSearchInput,
  query: string,
  source: KnowledgeSourceProjection,
  corpus: EligibleKnowledgeCorpus
): Promise<CandidateSourceResult> {
  try {
    return await input.candidateSource.findCandidates({
      corpus: materializeEligibleKnowledge(source, corpus),
      query,
    });
  } catch {
    return {
      kind: 'unavailable',
      message: 'candidate source failed during retrieval',
    };
  }
}

function candidateFailure(
  result: Exclude<CandidateSourceResult, { readonly kind: 'candidates' }>,
  context: SearchContext
): SearchOutcome {
  return result.kind === 'unsupported'
    ? { kind: 'unsupported', operation: result.operation }
    : {
        context,
        diagnostics: [],
        kind: 'unavailable',
        message: result.message,
        reason: 'backend-unavailable',
      };
}

function inactiveNotices(
  source: KnowledgeSourceProjection,
  corpus: EligibleKnowledgeCorpus,
  input: AssessedSearchInput
): readonly SearchNotice[] {
  if (input.scope.lifecycle.kind !== 'active-only') return [];
  const expanded = selectEligibleKnowledge(
    source,
    input.repository.projection.inventory,
    {
      ...input.scope,
      lifecycle: { kind: 'include-non-active' },
    }
  );
  const excludedArtifacts =
    expanded.artifactIds.length - corpus.artifactIds.length;
  return excludedArtifacts === 0
    ? []
    : [{ excludedArtifacts, kind: 'inactive-content-excluded' }];
}
