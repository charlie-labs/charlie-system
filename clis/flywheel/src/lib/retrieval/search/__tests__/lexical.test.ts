import { expect, test } from 'bun:test';

import { compileAndAssessRepository } from '../../../validation/assess.js';
import { corpusSource } from '../../corpus/__tests__/corpus-fixture.js';
import {
  createRetrievalScope,
  materializeEligibleKnowledge,
  selectEligibleKnowledge,
} from '../../corpus/eligibility.js';
import { projectKnowledge } from '../../corpus/project.js';
import { createLexicalCandidateSource } from '../lexical.js';

test('ranks only eligible source units deterministically', async () => {
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
  const request = {
    corpus: materializeEligibleKnowledge(source, corpus),
    query: 'repository deployment guidance',
  };
  const first = await candidateSource.findCandidates(request);
  const second = await candidateSource.findCandidates(request);

  expect(first).toEqual(second);
  expect(first.kind).toBe('candidates');
  if (first.kind !== 'candidates') return;
  const eligibleUnits = new Set(request.corpus.units.map((unit) => unit.id));
  expect(first.candidates.length).toBeGreaterThan(0);
  expect(
    first.candidates.every(
      (candidate) =>
        eligibleUnits.has(candidate.unitId) &&
        Number.isFinite(candidate.score) &&
        candidate.score > 0
    )
  ).toBe(true);
  expect(
    first.candidates.every(
      (candidate, index) =>
        index === 0 ||
        candidate.score <= (first.candidates[index - 1]?.score ?? 0)
    )
  ).toBe(true);
});

test('returns no candidates when no eligible unit matches', async () => {
  const repository = await compileAndAssessRepository(corpusSource());
  const source = projectKnowledge(repository);
  const corpus = selectEligibleKnowledge(
    source,
    repository.projection.inventory,
    createRetrievalScope({
      contentTypes: ['catalog'],
      customerWideOnly: true,
      includeNonActive: false,
      repositoryIds: [],
    })
  );

  const result = await createLexicalCandidateSource().findCandidates({
    corpus: materializeEligibleKnowledge(source, corpus),
    query: 'nonexistent-quantum-term',
  });
  expect(result).toEqual({ candidates: [], kind: 'candidates' });
});
