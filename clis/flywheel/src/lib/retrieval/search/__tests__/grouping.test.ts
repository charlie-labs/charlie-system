import { expect, test } from 'bun:test';

import { validationSource } from '../../../validation/__tests__/repository-fixture.js';
import { compileAndAssessRepository } from '../../../validation/assess.js';
import { corpusSource } from '../../corpus/__tests__/corpus-fixture.js';
import {
  createRetrievalScope,
  selectEligibleKnowledge,
} from '../../corpus/eligibility.js';
import { projectKnowledge } from '../../corpus/project.js';
import type { PassageCandidate } from '../candidate-source.js';
import { groupCandidates } from '../group.js';

test('groups passages by artifact with source fidelity and only used citations', async () => {
  const repository = await compileAndAssessRepository(
    validationSource({
      'customer-wide/docs/guide.md': structuredDocument,
    }).source
  );
  const source = projectKnowledge(repository);
  const corpus = selectEligibleKnowledge(
    source,
    repository.projection.inventory,
    scope(['document'])
  );
  const opening = source.units.find((unit) =>
    unit.authoredText.includes('Opening alpha')
  );
  const ending = source.units.find((unit) =>
    unit.authoredText.includes('Ending gamma')
  );
  expect(opening).toBeDefined();
  expect(ending).toBeDefined();
  expect(ending?.section).toBeDefined();
  if (
    opening === undefined ||
    ending === undefined ||
    ending.section === undefined
  ) {
    return;
  }

  const grouped = groupCandidates({
    artifactLimit: 1,
    candidates: [candidate(ending, 10), candidate(opening, 5)],
    corpus,
    passageLimitPerArtifact: 1,
    source,
  });

  expect(grouped.kind).toBe('grouped');
  if (grouped.kind !== 'grouped') return;
  const result = grouped.results[0];
  expect(result?.title).toBe('Guide');
  expect(result?.passages).toEqual([
    {
      authoredText: 'Ending gamma.[^last]',
      headingPath: ['Guide', 'Details'],
      omittedAfter: false,
      omittedBefore: true,
      section: ending.section,
      source: ending.source,
      structuralKind: 'prose',
    },
  ]);
  expect(result?.citations.map((citation) => citation.key)).toEqual(['last']);
  expect(grouped.notices).toEqual([
    {
      kind: 'response-shortened',
      omittedArtifacts: 0,
      omittedPassages: 1,
    },
  ]);
  expect(result === undefined ? false : 'score' in result).toBe(false);
});

test('applies artifact budgets after grouping and ignores ineligible candidates', async () => {
  const repository = await compileAndAssessRepository(corpusSource());
  const source = projectKnowledge(repository);
  const corpus = selectEligibleKnowledge(
    source,
    repository.projection.inventory,
    scope([])
  );
  const eligible = source.units.filter((unit) =>
    corpus.unitIds.includes(unit.id)
  );
  const inactive = source.units.find((unit) =>
    unit.authoredText.includes('Retained legacy')
  );
  expect(inactive).toBeDefined();
  const candidates: PassageCandidate[] = eligible.map((unit, index) =>
    candidate(unit, eligible.length - index)
  );
  if (inactive !== undefined) candidates.unshift(candidate(inactive, 1000));

  const grouped = groupCandidates({
    artifactLimit: 2,
    candidates,
    corpus,
    passageLimitPerArtifact: 1,
    source,
  });

  expect(grouped.kind).toBe('grouped');
  if (grouped.kind !== 'grouped') return;
  expect(grouped.results).toHaveLength(2);
  expect(
    grouped.results.some((result) => result.title === 'Legacy operations')
  ).toBe(false);
  expect(grouped.notices).toEqual([
    {
      kind: 'response-shortened',
      omittedArtifacts: 2,
      omittedPassages: 4,
    },
  ]);
});

test('rejects candidates that do not map to canonical source units', async () => {
  const repository = await compileAndAssessRepository(corpusSource());
  const source = projectKnowledge(repository);
  const corpus = selectEligibleKnowledge(
    source,
    repository.projection.inventory,
    scope([])
  );

  expect(
    groupCandidates({
      artifactLimit: 1,
      candidates: [
        { artifact: 'document:missing', score: 1, unitId: 'missing' },
      ],
      corpus,
      passageLimitPerArtifact: 1,
      source,
    })
  ).toEqual({
    kind: 'invalid-candidates',
    message: 'candidate identifies an unknown source unit: missing',
  });
});

function candidate(
  unit: ReturnType<typeof projectKnowledge>['units'][number],
  score: number
): PassageCandidate {
  return { artifact: unit.artifact, score, unitId: unit.id };
}

function scope(contentTypes: readonly ('catalog' | 'document')[]) {
  return createRetrievalScope({
    contentTypes,
    customerWideOnly: false,
    includeNonActive: false,
    repositoryIds: [],
  });
}

const structuredDocument = `---
purpose: Explain the guide.
reviewEvery: 90d
---
# Guide

Opening alpha.[^first]

## Details

Middle beta.

Ending gamma.[^last]

[^first]: [First](https://example.com/first)
[^last]: [Last](https://example.com/last)
`;
