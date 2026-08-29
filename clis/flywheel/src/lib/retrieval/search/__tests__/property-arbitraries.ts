import { retrievalCandidateArbitrary } from '../../../__tests__/arbitraries.js';
import { fc } from '../../../__tests__/fast-check.js';
import type { RepositoryInventory } from '../../../repository/contract.js';
import { sortedCopy } from '../../../repository/ordering.js';
import { targetId } from '../../../targets/id.js';
import type {
  EligibleKnowledgeCorpus,
  KnowledgeSourceProjection,
  RetrievalScope,
} from '../../corpus/contract.js';
import {
  createRetrievalScope,
  selectEligibleKnowledge,
} from '../../corpus/eligibility.js';
import type { PassageCandidate } from '../candidate-source.js';

export { retrievalCandidateArbitrary };

export const retrievalQueryArbitrary = fc.stringMatching(
  /^[a-z][a-z0-9-]{0,12}(?: [a-z][a-z0-9-]{0,12}){0,2}$/u
);

export function retrievalScopeArbitrary(): fc.Arbitrary<RetrievalScope> {
  const options = fc.record({
    contentType: fc.constantFrom<'catalog' | 'document'>('catalog', 'document'),
    includeNonActive: fc.boolean(),
  });
  return fc.oneof(
    options.map(({ contentType, includeNonActive }) =>
      createRetrievalScope({
        contentTypes: [contentType],
        customerWideOnly: false,
        includeNonActive,
        repositoryIds: [],
      })
    ),
    options.map(({ contentType, includeNonActive }) =>
      createRetrievalScope({
        contentTypes: [contentType],
        customerWideOnly: false,
        includeNonActive,
        repositoryIds: [' acme/api ', 'acme/api'],
      })
    ),
    options.map(({ contentType, includeNonActive }) =>
      createRetrievalScope({
        contentTypes: [contentType],
        customerWideOnly: true,
        includeNonActive,
        repositoryIds: [],
      })
    )
  );
}

export type RetrievalScenario = Readonly<{
  readonly artifactLimit: number;
  readonly candidates: readonly PassageCandidate[];
  readonly query: string;
  readonly scope: RetrievalScope;
}>;

export function retrievalScenarioArbitrary(
  source: KnowledgeSourceProjection,
  inventory: RepositoryInventory
): fc.Arbitrary<RetrievalScenario> {
  return retrievalScopeArbitrary().chain((scope) =>
    fc
      .record({
        artifactLimit: fc.integer({ min: 1, max: 3 }),
        candidates: generatedCandidatePermutationArbitrary(
          source,
          inventory,
          scope
        ),
        query: retrievalQueryArbitrary,
      })
      .map(({ artifactLimit, candidates, query }) => ({
        artifactLimit,
        candidates,
        query,
        scope,
      }))
  );
}

function generatedCandidatePermutationArbitrary(
  source: KnowledgeSourceProjection,
  inventory: RepositoryInventory,
  scope: RetrievalScope
): fc.Arbitrary<readonly PassageCandidate[]> {
  const corpus = selectEligibleKnowledge(source, inventory, scope);
  const eligibleUnits = source.units.filter((unit) =>
    corpus.unitIds.includes(unit.id)
  );
  const ineligibleUnits = source.units.filter(
    (unit) => !corpus.unitIds.includes(unit.id)
  );
  if (eligibleUnits.length === 0 || ineligibleUnits.length === 0) {
    throw new Error('retrieval fixture must provide mixed eligibility');
  }
  const eligibleCandidate = retrievalCandidateArbitrary(eligibleUnits);
  const highScoreIneligibleCandidate = fc
    .constantFrom(...ineligibleUnits)
    .map((unit) => ({
      artifact: unit.artifact,
      score: 1000 + unit.id.length,
      unitId: unit.id,
    }));
  return fc
    .tuple(
      eligibleCandidate,
      fc.array(eligibleCandidate, { maxLength: 6 }),
      highScoreIneligibleCandidate,
      fc.array(highScoreIneligibleCandidate, { maxLength: 6 })
    )
    .chain(
      ([eligibleAnchor, eligibleRest, ineligibleAnchor, ineligibleRest]) => {
        const all = [
          eligibleAnchor,
          eligibleAnchor,
          ...eligibleRest,
          ineligibleAnchor,
          ineligibleAnchor,
          ...ineligibleRest,
        ];
        return fc.shuffledSubarray(all, {
          minLength: all.length,
          maxLength: all.length,
        });
      }
    );
}

export function expectedArtifactIds(
  candidates: readonly PassageCandidate[],
  corpus: EligibleKnowledgeCorpus,
  artifactLimit: number
): readonly string[] {
  const eligibleUnits = new Set(corpus.unitIds);
  const eligibleArtifacts = new Set(corpus.artifactIds);
  const bestUnitScores = new Map<string, PassageCandidate>();
  for (const candidate of candidates) {
    if (
      !eligibleUnits.has(candidate.unitId) ||
      !eligibleArtifacts.has(candidate.artifact)
    ) {
      continue;
    }
    const existing = bestUnitScores.get(candidate.unitId);
    if (existing === undefined || candidate.score > existing.score) {
      bestUnitScores.set(candidate.unitId, candidate);
    }
  }
  const bestArtifactScores = new Map<string, number>();
  for (const candidate of bestUnitScores.values()) {
    const existing = bestArtifactScores.get(candidate.artifact) ?? -Infinity;
    bestArtifactScores.set(
      candidate.artifact,
      Math.max(existing, candidate.score)
    );
  }
  return sortedCopy(
    [...bestArtifactScores],
    ([leftArtifact, leftScore], [rightArtifact, rightScore]) =>
      rightScore - leftScore || leftArtifact.localeCompare(rightArtifact)
  )
    .slice(0, artifactLimit)
    .map(([artifact]) => artifact);
}

export function searchResultArtifactIds(
  results: readonly { readonly artifact: Parameters<typeof targetId>[0] }[]
): readonly string[] {
  return results.map((result) => targetId(result.artifact));
}
