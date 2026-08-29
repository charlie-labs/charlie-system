import { expect, test } from 'bun:test';

import {
  assert,
  fc,
  fastCheckParameters,
} from '../../../__tests__/fast-check.js';
import { compileAndAssessRepository } from '../../../validation/assess.js';
import { corpusSource } from '../../corpus/__tests__/corpus-fixture.js';
import {
  createRetrievalScope,
  materializeEligibleKnowledge,
  selectEligibleKnowledge,
} from '../../corpus/eligibility.js';
import { projectKnowledge } from '../../corpus/project.js';
import { groupCandidates } from '../group.js';
import { createLexicalCandidateSource } from '../lexical.js';
import { searchAssessedRepository } from '../search.js';
import {
  expectedArtifactIds,
  retrievalCandidateArbitrary,
  retrievalQueryArbitrary,
  retrievalScenarioArbitrary,
  retrievalScopeArbitrary,
  searchResultArtifactIds,
} from './property-arbitraries.js';
import type { RetrievalScenario } from './property-arbitraries.js';

test('retrieval eligibility is monotonic and materializes only selected artifacts and units', async () => {
  const repository = await compileAndAssessRepository(corpusSource());
  const source = projectKnowledge(repository);
  assert(
    fc.property(retrievalScopeArbitrary(), (scope) => {
      assertEligibility(source, repository.projection.inventory, scope);
    }),
    fastCheckParameters
  );
});

test('lexical retrieval produces finite deterministic candidates tied to the corpus', async () => {
  const repository = await compileAndAssessRepository(corpusSource());
  const source = projectKnowledge(repository);
  const corpus = selectEligibleKnowledge(
    source,
    repository.projection.inventory,
    createRetrievalScope({
      contentTypes: [],
      customerWideOnly: false,
      includeNonActive: false,
      repositoryIds: [],
    })
  );
  const candidateSource = createLexicalCandidateSource();
  await fc.assert(
    fc.asyncProperty(retrievalQueryArbitrary, async (query) => {
      const request = {
        corpus: materializeEligibleKnowledge(source, corpus),
        query,
      };
      const first = await candidateSource.findCandidates(request);
      const second = await candidateSource.findCandidates(request);
      expect(first).toEqual(second);
      expect(first.kind).toBe('candidates');
      if (first.kind !== 'candidates') return;
      const unitIds = new Set(request.corpus.units.map((unit) => unit.id));
      expect(
        first.candidates.every(
          (candidate) =>
            unitIds.has(candidate.unitId) &&
            Number.isFinite(candidate.score) &&
            candidate.score > 0
        )
      ).toBe(true);
      expect(
        first.candidates.every(
          (candidate, index) =>
            index === 0 ||
            candidate.score <=
              (first.candidates[index - 1]?.score ?? candidate.score)
        )
      ).toBe(true);
    }),
    fastCheckParameters
  );
});

test('grouping deduplicates source units and applies artifact limits after grouping', async () => {
  const repository = await compileAndAssessRepository(corpusSource());
  const source = projectKnowledge(repository);
  const corpus = selectEligibleKnowledge(
    source,
    repository.projection.inventory,
    createRetrievalScope({
      contentTypes: ['document'],
      customerWideOnly: false,
      includeNonActive: true,
      repositoryIds: [],
    })
  );
  const eligible = materializeEligibleKnowledge(source, corpus);
  assert(
    fc.property(
      fc.array(retrievalCandidateArbitrary(eligible.units), {
        minLength: 1,
        maxLength: 16,
      }),
      fc.integer({ min: 1, max: 3 }),
      (candidates, artifactLimit) => {
        const grouped = groupCandidates({
          artifactLimit,
          candidates,
          corpus,
          passageLimitPerArtifact: 2,
          source,
        });
        expect(grouped.kind).toBe('grouped');
        if (grouped.kind !== 'grouped') return;
        expect(grouped.results.length).toBeLessThanOrEqual(artifactLimit);
        expect(new Set(grouped.results.map((result) => result.path)).size).toBe(
          grouped.results.length
        );
        expect(
          grouped.results.every((result) => result.passages.length <= 2)
        ).toBe(true);
        expect(grouped.results.every(hasUniquePassageSources)).toBe(true);
        expect(sourceFaithfulResults(grouped.results, eligible.units)).toBe(
          true
        );
      }
    ),
    fastCheckParameters
  );
});

test('search applies generated eligibility before ranking and grouped artifact cutoff', async () => {
  const repository = await compileAndAssessRepository(corpusSource());
  const source = projectKnowledge(repository);
  await fc.assert(
    fc.asyncProperty(
      retrievalScenarioArbitrary(source, repository.projection.inventory),
      (scenario) => assertGeneratedSearchScenario(repository, source, scenario)
    ),
    fastCheckParameters
  );
});

async function assertGeneratedSearchScenario(
  repository: Awaited<ReturnType<typeof compileAndAssessRepository>>,
  source: ReturnType<typeof projectKnowledge>,
  { artifactLimit, candidates, query, scope }: RetrievalScenario
): Promise<void> {
  const corpus = selectEligibleKnowledge(
    source,
    repository.projection.inventory,
    scope
  );
  const observedCorpora: ReturnType<typeof materializeEligibleKnowledge>[] = [];
  const candidateSource: Parameters<
    typeof searchAssessedRepository
  >[0]['candidateSource'] = {
    findCandidates: ({ corpus: candidateCorpus }) => {
      observedCorpora.push(candidateCorpus);
      return Promise.resolve({
        candidates,
        kind: 'candidates' as const,
      });
    },
  };
  const result = await searchAssessedRepository({
    artifactLimit,
    candidateSource,
    passageLimitPerArtifact: 1,
    query,
    repository,
    scope,
  });

  expect(result.kind).toBe('results');
  if (result.kind !== 'results') return;
  expect(observedCorpora).toHaveLength(1);
  expect(observedCorpora[0]?.units.map((unit) => unit.id)).toEqual(
    materializeEligibleKnowledge(source, corpus).units.map((unit) => unit.id)
  );
  const resultArtifactIds = searchResultArtifactIds(result.results);
  expect(resultArtifactIds).toEqual(
    expectedArtifactIds(candidates, corpus, artifactLimit)
  );
  expect(result.results.length).toBeLessThanOrEqual(artifactLimit);
  expect(new Set(resultArtifactIds).size).toBe(result.results.length);
  expect(
    resultArtifactIds.every((artifactId) =>
      corpus.artifactIds.includes(artifactId)
    )
  ).toBe(true);
}

function assertEligibility(
  source: ReturnType<typeof projectKnowledge>,
  inventory: Parameters<typeof selectEligibleKnowledge>[1],
  scope: ReturnType<typeof createRetrievalScope>
): void {
  const active = selectEligibleKnowledge(source, inventory, {
    ...scope,
    lifecycle: { kind: 'active-only' },
  });
  const expanded = selectEligibleKnowledge(source, inventory, {
    ...scope,
    lifecycle: { kind: 'include-non-active' },
  });
  expect(
    active.artifactIds.every((id) => expanded.artifactIds.includes(id))
  ).toBe(true);
  expect(active.unitIds.every((id) => expanded.unitIds.includes(id))).toBe(
    true
  );
  const materialized = materializeEligibleKnowledge(source, expanded);
  expect(materialized.artifacts.length).toBe(expanded.artifactIds.length);
  expect(materialized.artifacts.map((artifact) => artifact.kind)).not.toContain(
    'role'
  );
  expect(
    materialized.units.every((unit) => expanded.unitIds.includes(unit.id))
  ).toBe(true);
}

function sourceFaithfulResults(
  results: readonly {
    readonly passages: readonly {
      readonly authoredText: string;
      readonly source: unknown;
    }[];
  }[],
  units: readonly { readonly authoredText: string; readonly source: unknown }[]
): boolean {
  for (const result of results) {
    for (const passage of result.passages) {
      const canonical = units.some(
        (unit) =>
          unit.source === passage.source &&
          unit.authoredText === passage.authoredText
      );
      if (!canonical) return false;
    }
  }
  return true;
}

function hasUniquePassageSources(result: {
  readonly passages: readonly { readonly source: unknown }[];
}): boolean {
  return (
    new Set(result.passages.map((passage) => JSON.stringify(passage.source)))
      .size === result.passages.length
  );
}
